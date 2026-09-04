package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import java.nio.charset.StandardCharsets;

import java.security.MessageDigest;

import java.time.LocalDateTime;

import java.util.Base64;
import java.util.HexFormat;

@Service
public class ParentNotificationSecureTokenService {

    private static final String HMAC_ALGORITHM =
            "HmacSHA256";

    private static final String TOKEN_PREFIX =
            "svn1_";

    private static final String TOKEN_CONTEXT =
            "SVNHS_PARENT_NOTIFICATION_V1:";

    private static final int MINIMUM_SECRET_BYTES =
            32;

    private final byte[] secretKey;

    private final int tokenValidDays;

    public ParentNotificationSecureTokenService(

            @Value(
                    "${app.parent-notification.token-secret}"
            )
            String tokenSecret,

            @Value(
                    "${app.parent-notification.token-valid-days:14}"
            )
            int tokenValidDays
    ) {

        this.secretKey =
                decodeAndValidateSecret(
                        tokenSecret
                );

        if (tokenValidDays < 1 ||
                tokenValidDays > 365) {

            throw new IllegalStateException(
                    "Parent notification token validity must be between 1 and 365 days"
            );
        }

        this.tokenValidDays =
                tokenValidDays;
    }

    /* =====================================================
       INITIALIZE TOKEN METADATA
    ===================================================== */

    public String initializeTokenMetadata(
            ParentNotification notification
    ) {

        validateNotification(
                notification
        );

        String rawToken =
                deriveRawToken(
                        notification.getId()
                );

        String tokenHash =
                hashRawToken(
                        rawToken
                );

        String existingHash =
                notification
                        .getAcknowledgementTokenHash();

        if (existingHash != null &&
                !existingHash.isBlank() &&
                !constantTimeEquals(
                        existingHash,
                        tokenHash
                )) {

            throw new IllegalStateException(
                    "Parent notification token does not match the configured token secret"
            );
        }

        notification
                .setAcknowledgementTokenHash(
                        tokenHash
                );

        if (notification.getTokenExpiresAt() == null) {

            notification
                    .setTokenExpiresAt(
                            AppTime.now()
                                    .plusDays(
                                            tokenValidDays
                                    )
                    );
        }

        return rawToken;
    }

    /* =====================================================
       GET RAW TOKEN FOR EMAIL
    ===================================================== */

    public String getRawTokenForEmail(
            ParentNotification notification
    ) {

        validateNotification(
                notification
        );

        String storedHash =
                notification
                        .getAcknowledgementTokenHash();

        if (storedHash == null ||
                storedHash.isBlank()) {

            throw new IllegalStateException(
                    "Parent notification secure token has not been initialized"
            );
        }

        String rawToken =
                deriveRawToken(
                        notification.getId()
                );

        String derivedHash =
                hashRawToken(
                        rawToken
                );

        if (!constantTimeEquals(
                storedHash,
                derivedHash
        )) {

            throw new IllegalStateException(
                    "Parent notification secure token validation failed"
            );
        }

        return rawToken;
    }

    /* =====================================================
       HASH INCOMING TOKEN
    ===================================================== */

    public String hashIncomingToken(
            String rawToken
    ) {

        if (rawToken == null ||
                rawToken.isBlank()) {

            throw new IllegalArgumentException(
                    "Parent notification token is required"
            );
        }

        String normalized =
                rawToken.trim();

        if (!normalized.startsWith(
                TOKEN_PREFIX
        )) {

            throw new IllegalArgumentException(
                    "Invalid parent notification token"
            );
        }

        return hashRawToken(
                normalized
        );
    }

    /* =====================================================
       CHECK EXPIRATION
    ===================================================== */

    public boolean isExpired(
            ParentNotification notification
    ) {

        if (notification == null) {

            return true;
        }

        LocalDateTime expiresAt =
                notification
                        .getTokenExpiresAt();

        if (expiresAt == null) {

            return true;
        }

        return !AppTime.now()
                .isBefore(
                        expiresAt
                );
    }

    /* =====================================================
       DERIVE RAW TOKEN
    ===================================================== */

    private String deriveRawToken(
            String parentNotificationId
    ) {

        try {

            Mac mac =
                    Mac.getInstance(
                            HMAC_ALGORITHM
                    );

            SecretKeySpec keySpec =
                    new SecretKeySpec(
                            secretKey,
                            HMAC_ALGORITHM
                    );

            mac.init(
                    keySpec
            );

            String tokenMaterial =
                    TOKEN_CONTEXT +
                            parentNotificationId;

            byte[] digest =
                    mac.doFinal(
                            tokenMaterial
                                    .getBytes(
                                            StandardCharsets.UTF_8
                                    )
                    );

            String encoded =
                    Base64
                            .getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(
                                    digest
                            );

            return TOKEN_PREFIX +
                    encoded;
        }

        catch (Exception exception) {

            throw new IllegalStateException(
                    "Unable to generate parent notification secure token",
                    exception
            );
        }
    }

    /* =====================================================
       SHA-256 HASH
    ===================================================== */

    private String hashRawToken(
            String rawToken
    ) {

        try {

            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            byte[] hash =
                    digest.digest(
                            rawToken
                                    .getBytes(
                                            StandardCharsets.UTF_8
                                    )
                    );

            return HexFormat
                    .of()
                    .formatHex(
                            hash
                    );
        }

        catch (Exception exception) {

            throw new IllegalStateException(
                    "Unable to hash parent notification token",
                    exception
            );
        }
    }

    /* =====================================================
       CONSTANT-TIME COMPARISON
    ===================================================== */

    private boolean constantTimeEquals(
            String left,
            String right
    ) {

        if (left == null ||
                right == null) {

            return false;
        }

        return MessageDigest.isEqual(
                left.getBytes(
                        StandardCharsets.UTF_8
                ),
                right.getBytes(
                        StandardCharsets.UTF_8
                )
        );
    }

    /* =====================================================
       SECRET VALIDATION
    ===================================================== */

    private byte[] decodeAndValidateSecret(
            String value
    ) {

        if (value == null ||
                value.isBlank()) {

            throw new IllegalStateException(
                    "Parent notification token secret is not configured"
            );
        }

        try {

            byte[] decoded =
                    Base64
                            .getDecoder()
                            .decode(
                                    value.trim()
                            );

            if (decoded.length <
                    MINIMUM_SECRET_BYTES) {

                throw new IllegalStateException(
                        "Parent notification token secret must contain at least 32 random bytes"
                );
            }

            return decoded;
        }

        catch (IllegalArgumentException exception) {

            throw new IllegalStateException(
                    "Parent notification token secret must be valid Base64",
                    exception
            );
        }
    }

    /* =====================================================
       NOTIFICATION VALIDATION
    ===================================================== */

    private void validateNotification(
            ParentNotification notification
    ) {

        if (notification == null) {

            throw new IllegalArgumentException(
                    "Parent notification is required"
            );
        }

        if (notification.getId() == null ||
                notification
                        .getId()
                        .isBlank()) {

            throw new IllegalStateException(
                    "Parent notification must be saved before generating its secure token"
            );
        }
    }
}