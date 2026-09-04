package com.example.attendancemanagementbackend.service.email;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import java.nio.charset.StandardCharsets;

import java.time.Duration;
import java.time.Instant;

import java.util.Base64;

@Service
@ConditionalOnProperty(
        name = "app.email.provider",
        havingValue = "gmail-api"
)
public class GmailApiEmailSender
        implements EmailSender {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    GmailApiEmailSender.class
            );

    private static final URI TOKEN_URI =
            URI.create(
                    "https://oauth2.googleapis.com/token"
            );

    private static final URI SEND_URI =
            URI.create(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
            );

    private final ObjectMapper
            objectMapper;

    private final HttpClient
            httpClient;

    private final String
            clientId;

    private final String
            clientSecret;

    private final String
            refreshToken;

    private final String
            senderEmail;

    private final String
            senderName;

    /* =====================================================
       ACCESS TOKEN CACHE
    ===================================================== */

    private volatile String
            cachedAccessToken;

    private volatile Instant
            cachedAccessTokenExpiresAt;

    public GmailApiEmailSender(
            ObjectMapper objectMapper,

            @Value(
                    "${app.email.gmail-api.client-id}"
            )
            String clientId,

            @Value(
                    "${app.email.gmail-api.client-secret}"
            )
            String clientSecret,

            @Value(
                    "${app.email.gmail-api.refresh-token}"
            )
            String refreshToken,

            @Value(
                    "${app.email.gmail-api.sender-email}"
            )
            String senderEmail,

            @Value(
                    "${app.email.gmail-api.sender-name:SVNHS Attendance Management System}"
            )
            String senderName
    ) {

        this.objectMapper =
                objectMapper;

        this.clientId =
                requireConfig(
                        clientId,
                        "Google Gmail client ID"
                );

        this.clientSecret =
                requireConfig(
                        clientSecret,
                        "Google Gmail client secret"
                );

        this.refreshToken =
                requireConfig(
                        refreshToken,
                        "Google Gmail refresh token"
                );

        this.senderEmail =
                requireConfig(
                        senderEmail,
                        "Google Gmail sender email"
                );

        this.senderName =
                normalizeSenderName(
                        senderName
                );

        this.httpClient =
                HttpClient.newBuilder()
                        .connectTimeout(
                                Duration.ofSeconds(
                                        10
                                )
                        )
                        .build();
    }

    /* =====================================================
       SEND EMAIL
    ===================================================== */

    @Override
    public void send(
            EmailMessage message
    ) {

        validateMessage(
                message
        );

        try {

            /* =================================================
               GET VALID GOOGLE ACCESS TOKEN
            ================================================= */

            String accessToken =
                    getAccessToken();

            /* =================================================
               BUILD RFC / MIME MESSAGE
            ================================================= */

            String mimeMessage =
                    buildMimeMessage(
                            message
                    );

            /* =================================================
               GMAIL API REQUIRES BASE64URL
            ================================================= */

            String encodedMessage =
                    Base64
                            .getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(
                                    mimeMessage
                                            .getBytes(
                                                    StandardCharsets.UTF_8
                                            )
                            );

            /* =================================================
               BUILD GMAIL API JSON
            ================================================= */

            String requestBody =
                    objectMapper
                            .createObjectNode()
                            .put(
                                    "raw",
                                    encodedMessage
                            )
                            .toString();

            /* =================================================
               SEND THROUGH GMAIL API
            ================================================= */

            HttpRequest request =
                    HttpRequest
                            .newBuilder()
                            .uri(
                                    SEND_URI
                            )
                            .timeout(
                                    Duration.ofSeconds(
                                            20
                                    )
                            )
                            .header(
                                    "Authorization",
                                    "Bearer " +
                                            accessToken
                            )
                            .header(
                                    "Content-Type",
                                    "application/json; charset=UTF-8"
                            )
                            .header(
                                    "Accept",
                                    "application/json"
                            )
                            .POST(
                                    HttpRequest.BodyPublishers
                                            .ofString(
                                                    requestBody,
                                                    StandardCharsets.UTF_8
                                            )
                            )
                            .build();

            HttpResponse<String> response =
                    httpClient.send(
                            request,
                            HttpResponse.BodyHandlers
                                    .ofString(
                                            StandardCharsets.UTF_8
                                    )
                    );

            int statusCode =
                    response.statusCode();

            /* =================================================
               HANDLE GMAIL ERROR
            ================================================= */

            if (statusCode < 200 ||
                    statusCode >= 300) {

                /*
                 * If Google rejects the access token,
                 * remove the cached token.
                 *
                 * The existing outbox retry system
                 * will later retry the email.
                 */
                if (statusCode == 401) {

                    clearCachedAccessToken();
                }

                throw new IllegalStateException(
                        "Gmail API rejected email delivery with HTTP " +
                                statusCode +
                                ": " +
                                safeGoogleError(
                                        response.body()
                                )
                );
            }

            /* =================================================
               READ GMAIL RESPONSE
            ================================================= */

            JsonNode responseJson =
                    objectMapper.readTree(
                            response.body()
                    );

            String gmailMessageId =
                    responseJson
                            .path(
                                    "id"
                            )
                            .asText(
                                    ""
                            );

            logger.info(
                    "Gmail API accepted parent attendance email: recipient={}, gmailMessageId={}",
                    maskEmail(
                            message.recipientEmail()
                    ),
                    gmailMessageId.isBlank()
                            ? "unknown"
                            : gmailMessageId
            );
        }

        catch (InterruptedException exception) {

            Thread
                    .currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "Gmail API email delivery was interrupted",
                    exception
            );
        }

        catch (Exception exception) {

            if (exception instanceof IllegalStateException) {

                throw (IllegalStateException) exception;
            }

            throw new IllegalStateException(
                    "Gmail API email delivery failed: " +
                            safeExceptionMessage(
                                    exception
                            ),
                    exception
            );
        }
    }

    /* =====================================================
       GET ACCESS TOKEN
    ===================================================== */

    private String getAccessToken()
            throws Exception {

        String token =
                cachedAccessToken;

        Instant expiresAt =
                cachedAccessTokenExpiresAt;

        /*
         * Keep a 60-second safety margin.
         */
        if (token != null &&
                expiresAt != null &&
                Instant.now()
                        .isBefore(
                                expiresAt.minusSeconds(
                                        60
                                )
                        )) {

            return token;
        }

        synchronized (this) {

            token =
                    cachedAccessToken;

            expiresAt =
                    cachedAccessTokenExpiresAt;

            if (token != null &&
                    expiresAt != null &&
                    Instant.now()
                            .isBefore(
                                    expiresAt.minusSeconds(
                                            60
                                    )
                            )) {

                return token;
            }

            return refreshAccessToken();
        }
    }

    /* =====================================================
       REFRESH GOOGLE ACCESS TOKEN
    ===================================================== */

    private String refreshAccessToken()
            throws Exception {

        String formBody =
                "client_id=" +
                        encodeFormValue(
                                clientId
                        ) +

                        "&client_secret=" +
                        encodeFormValue(
                                clientSecret
                        ) +

                        "&refresh_token=" +
                        encodeFormValue(
                                refreshToken
                        ) +

                        "&grant_type=" +
                        encodeFormValue(
                                "refresh_token"
                        );

        HttpRequest request =
                HttpRequest
                        .newBuilder()
                        .uri(
                                TOKEN_URI
                        )
                        .timeout(
                                Duration.ofSeconds(
                                        15
                                )
                        )
                        .header(
                                "Content-Type",
                                "application/x-www-form-urlencoded"
                        )
                        .header(
                                "Accept",
                                "application/json"
                        )
                        .POST(
                                HttpRequest.BodyPublishers
                                        .ofString(
                                                formBody,
                                                StandardCharsets.UTF_8
                                        )
                        )
                        .build();

        HttpResponse<String> response =
                httpClient.send(
                        request,
                        HttpResponse.BodyHandlers
                                .ofString(
                                        StandardCharsets.UTF_8
                                )
                );

        int statusCode =
                response.statusCode();

        if (statusCode < 200 ||
                statusCode >= 300) {

            throw new IllegalStateException(
                    "Google OAuth token refresh failed with HTTP " +
                            statusCode +
                            ": " +
                            safeGoogleError(
                                    response.body()
                            )
            );
        }

        JsonNode json =
                objectMapper.readTree(
                        response.body()
                );

        String accessToken =
                json
                        .path(
                                "access_token"
                        )
                        .asText(
                                null
                        );

        long expiresIn =
                json
                        .path(
                                "expires_in"
                        )
                        .asLong(
                                3600L
                        );

        if (accessToken == null ||
                accessToken.isBlank()) {

            throw new IllegalStateException(
                    "Google OAuth token response did not contain an access token"
            );
        }

        cachedAccessToken =
                accessToken;

        cachedAccessTokenExpiresAt =
                Instant.now()
                        .plusSeconds(
                                Math.max(
                                        expiresIn,
                                        60L
                                )
                        );

        return accessToken;
    }

    /* =====================================================
       BUILD RFC 2822 / MIME EMAIL
    ===================================================== */

    private String buildMimeMessage(
            EmailMessage message
    ) {

        String safeRecipient =
                sanitizeHeaderValue(
                        message.recipientEmail()
                );

        String safeSenderEmail =
                sanitizeHeaderValue(
                        senderEmail
                );

        String encodedSubject =
                encodeHeaderValue(
                        message.subject()
                );

        String encodedSenderName =
                encodeHeaderValue(
                        senderName
                );

        String textBody =
                normalizeBody(
                        message.textBody()
                );

        String htmlBody =
                message.htmlBody();

        /* =====================================================
           PLAIN TEXT FALLBACK

           Keeps compatibility with existing EmailMessage
           instances that do not provide an HTML body.
        ===================================================== */

        if (htmlBody == null ||
                htmlBody.isBlank()) {

            return ""
                    + "From: "
                    + encodedSenderName
                    + " <"
                    + safeSenderEmail
                    + ">\r\n"

                    + "To: "
                    + safeRecipient
                    + "\r\n"

                    + "Subject: "
                    + encodedSubject
                    + "\r\n"

                    + "MIME-Version: 1.0\r\n"

                    + "Content-Type: text/plain; charset=UTF-8\r\n"

                    + "Content-Transfer-Encoding: 8bit\r\n"

                    + "\r\n"

                    + textBody;
        }

        /* =====================================================
           MULTIPART ALTERNATIVE

           Email clients can choose between:

           text/plain
           or
           text/html

           Gmail normally displays the HTML version.
        ===================================================== */

        String boundary =
                "SVNHS_BOUNDARY_" +
                        System.nanoTime();

        String normalizedHtmlBody =
                normalizeBody(
                        htmlBody
                );

        return ""
                /* ===============================
                   EMAIL HEADERS
                =============================== */

                + "From: "
                + encodedSenderName
                + " <"
                + safeSenderEmail
                + ">\r\n"

                + "To: "
                + safeRecipient
                + "\r\n"

                + "Subject: "
                + encodedSubject
                + "\r\n"

                + "MIME-Version: 1.0\r\n"

                + "Content-Type: multipart/alternative; boundary=\""
                + boundary
                + "\"\r\n"

                + "\r\n"

                /* ===============================
                   TEXT VERSION
                =============================== */

                + "--"
                + boundary
                + "\r\n"

                + "Content-Type: text/plain; charset=UTF-8\r\n"

                + "Content-Transfer-Encoding: 8bit\r\n"

                + "\r\n"

                + textBody
                + "\r\n"

                /* ===============================
                   HTML VERSION
                =============================== */

                + "--"
                + boundary
                + "\r\n"

                + "Content-Type: text/html; charset=UTF-8\r\n"

                + "Content-Transfer-Encoding: 8bit\r\n"

                + "\r\n"

                + normalizedHtmlBody
                + "\r\n"

                /* ===============================
                   CLOSE MULTIPART
                =============================== */

                + "--"
                + boundary
                + "--\r\n";
    }

    /* =====================================================
       HEADER ENCODING
    ===================================================== */

    private String encodeHeaderValue(
            String value
    ) {

        String sanitized =
                sanitizeHeaderValue(
                        value
                );

        /*
         * RFC 2047 encoded-word.
         *
         * Supports UTF-8 characters safely in:
         *
         * - email subject
         * - sender display name
         */
        String encoded =
                Base64
                        .getEncoder()
                        .encodeToString(
                                sanitized
                                        .getBytes(
                                                StandardCharsets.UTF_8
                                        )
                        );

        return "=?UTF-8?B?" +
                encoded +
                "?=";
    }

    /* =====================================================
       SANITIZE EMAIL HEADERS
    ===================================================== */

    private String sanitizeHeaderValue(
            String value
    ) {

        if (value == null) {

            return "";
        }

        /*
         * Prevent email header injection.
         */
        return value
                .replace(
                        "\r",
                        " "
                )
                .replace(
                        "\n",
                        " "
                )
                .trim();
    }

    /* =====================================================
       BODY NORMALIZATION
    ===================================================== */

    private String normalizeBody(
            String value
    ) {

        if (value == null) {

            return "";
        }

        /*
         * RFC email format uses CRLF.
         *
         * Normalize:
         *
         * Windows
         * Linux
         * macOS
         *
         * into a consistent CRLF format.
         */
        return value
                .replace(
                        "\r\n",
                        "\n"
                )
                .replace(
                        "\r",
                        "\n"
                )
                .replace(
                        "\n",
                        "\r\n"
                );
    }

    /* =====================================================
       VALIDATION
    ===================================================== */

    private void validateMessage(
            EmailMessage message
    ) {

        if (message == null) {

            throw new IllegalArgumentException(
                    "Email message is required"
            );
        }

        if (message.recipientEmail() == null ||
                message.recipientEmail().isBlank()) {

            throw new IllegalArgumentException(
                    "Email recipient is required"
            );
        }

        if (message.subject() == null ||
                message.subject().isBlank()) {

            throw new IllegalArgumentException(
                    "Email subject is required"
            );
        }

        /*
         * Plain text remains required because it is
         * our accessibility / compatibility fallback.
         */
        if (message.textBody() == null ||
                message.textBody().isBlank()) {

            throw new IllegalArgumentException(
                    "Email body is required"
            );
        }
    }

    /* =====================================================
       CONFIGURATION VALIDATION
    ===================================================== */

    private String requireConfig(
            String value,
            String name
    ) {

        if (value == null ||
                value.isBlank()) {

            throw new IllegalStateException(
                    name +
                            " is not configured"
            );
        }

        return value.trim();
    }

    private String normalizeSenderName(
            String value
    ) {

        if (value == null ||
                value.isBlank()) {

            return "SVNHS Attendance Management System";
        }

        return value.trim();
    }

    /* =====================================================
       URL ENCODING
    ===================================================== */

    private String encodeFormValue(
            String value
    ) {

        return URLEncoder.encode(
                value,
                StandardCharsets.UTF_8
        );
    }

    /* =====================================================
       ACCESS TOKEN CACHE
    ===================================================== */

    private void clearCachedAccessToken() {

        cachedAccessToken =
                null;

        cachedAccessTokenExpiresAt =
                null;
    }

    /* =====================================================
       SAFE GOOGLE ERROR
    ===================================================== */

    private String safeGoogleError(
            String body
    ) {

        if (body == null ||
                body.isBlank()) {

            return "No response body";
        }

        try {

            JsonNode json =
                    objectMapper.readTree(
                            body
                    );

            JsonNode error =
                    json.path(
                            "error"
                    );

            if (error.isTextual()) {

                return truncate(
                        error.asText()
                );
            }

            String description =
                    error
                            .path(
                                    "message"
                            )
                            .asText(
                                    ""
                            );

            if (!description.isBlank()) {

                return truncate(
                        description
                );
            }

            String oauthDescription =
                    json
                            .path(
                                    "error_description"
                            )
                            .asText(
                                    ""
                            );

            if (!oauthDescription.isBlank()) {

                return truncate(
                        oauthDescription
                );
            }
        }

        catch (Exception ignored) {

            /*
             * Fall back to the raw response body below.
             */
        }

        return truncate(
                body
        );
    }

    /* =====================================================
       SAFE EXCEPTION MESSAGE
    ===================================================== */

    private String safeExceptionMessage(
            Exception exception
    ) {

        if (exception == null) {

            return "Unknown error";
        }

        String message =
                exception.getMessage();

        if (message == null ||
                message.isBlank()) {

            return exception
                    .getClass()
                    .getSimpleName();
        }

        return truncate(
                message
        );
    }

    /* =====================================================
       TRUNCATE
    ===================================================== */

    private String truncate(
            String value
    ) {

        if (value == null) {

            return "";
        }

        String normalized =
                value.trim();

        int maxLength =
                1000;

        if (normalized.length() <=
                maxLength) {

            return normalized;
        }

        return normalized.substring(
                0,
                maxLength
        );
    }

    /* =====================================================
       MASK EMAIL IN LOGS
    ===================================================== */

    private String maskEmail(
            String email
    ) {

        if (email == null ||
                email.isBlank()) {

            return "***";
        }

        String normalized =
                email.trim();

        int atIndex =
                normalized.indexOf(
                        '@'
                );

        if (atIndex <= 1) {

            return "***";
        }

        return normalized.substring(
                0,
                1
        )
                + "***"
                + normalized.substring(
                atIndex
        );
    }
}