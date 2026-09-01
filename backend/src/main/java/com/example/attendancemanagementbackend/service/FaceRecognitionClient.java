package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.core.io.ByteArrayResource;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import org.springframework.stereotype.Component;

import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

@Component
public class FaceRecognitionClient {

    private final RestClient restClient;

    public FaceRecognitionClient(
            @Value("${face.service.base-url}") String baseUrl
    ) {

        this.restClient =
                RestClient.builder()
                        .baseUrl(baseUrl)
                        .build();
    }

    /* =====================================================
       FACE ENROLLMENT

       EXISTING behavior retained.
    ===================================================== */

    public FaceEnrollmentResult enrollFace(
            String studentId,
            byte[] imageBytes,
            String filename
    ) {

        ByteArrayResource imageResource =
                createImageResource(
                        imageBytes,
                        filename
                );

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add(
                "student_id",
                studentId
        );

        body.add(
                "image",
                imageResource
        );

        try {

            return restClient.post()
                    .uri("/enrollment")
                    .contentType(
                            MediaType.MULTIPART_FORM_DATA
                    )
                    .body(body)
                    .retrieve()
                    .body(
                            FaceEnrollmentResult.class
                    );

        } catch (RestClientResponseException exception) {

            if (
                    exception
                            .getStatusCode()
                            .value()
                            == 422
            ) {

                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        extractPythonError(
                                exception
                        )
                );
            }

            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Face recognition service failed"
            );
        }
    }

    /* =====================================================
       FACE RECOGNITION

       EXISTING behavior retained.
    ===================================================== */

    public FaceRecognitionResult recognizeFace(
            byte[] imageBytes,
            String filename
    ) {

        ByteArrayResource imageResource =
                createImageResource(
                        imageBytes,
                        filename
                );

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add(
                "image",
                imageResource
        );

        try {

            return restClient.post()
                    .uri("/recognize")
                    .contentType(
                            MediaType.MULTIPART_FORM_DATA
                    )
                    .body(body)
                    .retrieve()
                    .body(
                            FaceRecognitionResult.class
                    );

        } catch (RestClientResponseException exception) {

            if (
                    exception
                            .getStatusCode()
                            .value()
                            == 422
            ) {

                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        extractPythonError(
                                exception
                        )
                );
            }

            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Face recognition service failed"
            );
        }
    }

    /* =====================================================
       ACTIVE LIVENESS VERIFICATION

       NEW.

       Spring sends:

       - challenge_type
       - repeated baseline_images
       - repeated challenge_images

       IMPORTANT:

       challengeType must come from Spring's
       server-authoritative LivenessChallenge record.

       React/browser must NEVER be trusted to decide which
       challenge Python verifies.
    ===================================================== */

    public LivenessVerificationResult verifyLiveness(

            String challengeType,

            List<LivenessFrame> baselineFrames,

            List<LivenessFrame> challengeFrames
    ) {

        /* =================================================
           BASIC CLIENT-SIDE VALIDATION

           Python performs its own validation as well.

           These checks prevent obviously invalid internal
           requests from being sent downstream.
        ================================================= */

        if (
                challengeType == null ||
                        challengeType.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Liveness challenge type is required"
            );
        }

        if (
                baselineFrames == null ||
                        baselineFrames.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Baseline liveness frames are required"
            );
        }

        if (
                challengeFrames == null ||
                        challengeFrames.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Challenge liveness frames are required"
            );
        }

        /* =================================================
           BUILD MULTIPART BODY

           FastAPI expects:

           challenge_type = TURN_LEFT

           baseline_images = frame1
           baseline_images = frame2
           ...

           challenge_images = frame1
           challenge_images = frame2
           ...
        ================================================= */

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add(
                "challenge_type",
                challengeType
        );

        for (
                LivenessFrame frame
                : baselineFrames
        ) {

            validateLivenessFrame(
                    frame
            );

            body.add(
                    "baseline_images",
                    createImageResource(
                            frame.imageBytes(),
                            frame.filename()
                    )
            );
        }

        for (
                LivenessFrame frame
                : challengeFrames
        ) {

            validateLivenessFrame(
                    frame
            );

            body.add(
                    "challenge_images",
                    createImageResource(
                            frame.imageBytes(),
                            frame.filename()
                    )
            );
        }

        /* =================================================
           CALL PYTHON LIVENESS ENDPOINT
        ================================================= */

        try {

            LivenessVerificationResult result =
                    restClient.post()
                            .uri(
                                    "/liveness/verify"
                            )
                            .contentType(
                                    MediaType
                                            .MULTIPART_FORM_DATA
                            )
                            .body(body)
                            .retrieve()
                            .body(
                                    LivenessVerificationResult
                                            .class
                            );

            if (result == null) {

                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "Liveness service returned an empty response"
                );
            }

            return result;

        } catch (
                RestClientResponseException exception
        ) {

            if (
                    exception
                            .getStatusCode()
                            .value()
                            == 422
            ) {

                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        extractPythonError(
                                exception
                        )
                );
            }

            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Liveness verification service failed"
            );
        }
    }

    /* =====================================================
       VALIDATE LIVENESS FRAME
    ===================================================== */

    private void validateLivenessFrame(
            LivenessFrame frame
    ) {

        if (
                frame == null ||
                        frame.imageBytes() == null ||
                        frame.imageBytes().length == 0
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid liveness frame"
            );
        }
    }

    /* =====================================================
       IMAGE RESOURCE

       Existing helper retained and reused for liveness.
    ===================================================== */

    private ByteArrayResource createImageResource(
            byte[] imageBytes,
            String filename
    ) {

        String safeFilename =
                filename == null ||
                        filename.isBlank()
                        ? "face.jpg"
                        : filename;

        return new ByteArrayResource(
                imageBytes
        ) {

            @Override
            public String getFilename() {

                return safeFilename;
            }
        };
    }

    /* =====================================================
       PYTHON ERROR MESSAGE

       Existing behavior retained.
    ===================================================== */

    private String extractPythonError(
            RestClientResponseException exception
    ) {

        String body =
                exception
                        .getResponseBodyAsString();

        if (
                body == null ||
                        body.isBlank()
        ) {

            return "Face could not be processed";
        }

        /*
         * FastAPI normally returns:
         *
         * {
         *   "detail": "No face detected"
         * }
         *
         * For now return the raw body.
         * We can clean this further later.
         */

        return body;
    }

    /* =====================================================
       EXISTING RESPONSE TYPES
    ===================================================== */

    public record FaceEnrollmentResult(

            boolean success,

            String student_id,

            List<Double> embedding

    ) {
    }

    public record FaceRecognitionResult(

            boolean success,

            List<Double> embedding

    ) {
    }

    /* =====================================================
       NEW LIVENESS FRAME

       Internal Spring representation of one uploaded frame.

       This record is NOT the HTTP request from the frontend.
       The future controller/service will convert MultipartFile
       objects into these immutable values before calling
       Python.
    ===================================================== */

    public record LivenessFrame(

            byte[] imageBytes,

            String filename

    ) {
    }

    /* =====================================================
       NEW PYTHON LIVENESS RESPONSE

       Matches Python JSON exactly:

       {
         "success": true,
         "passed": true,
         "challenge_type": "BLINK",
         "status": "CHALLENGE_PASSED",
         "reason": null,
         "embedding": [...],
         "passive_live_score": 0.99,
         "max_continuity_distance": 0.12
       }

       When verification fails:

       embedding = null
    ===================================================== */

    public record LivenessVerificationResult(

            boolean success,

            boolean passed,

            String challenge_type,

            String status,

            String reason,

            List<Double> embedding,

            Double passive_live_score,

            Double max_continuity_distance

    ) {
    }
}