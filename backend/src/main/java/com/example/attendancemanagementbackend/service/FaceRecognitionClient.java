package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.exception.ApiException;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.beans.factory.annotation.Value;

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

            if (exception.getStatusCode().value() == 422) {

                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        extractPythonError(exception)
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

            if (exception.getStatusCode().value() == 422) {

                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        extractPythonError(exception)
                );
            }

            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Face recognition service failed"
            );
        }
    }

    /* =====================================================
       IMAGE RESOURCE
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
    ===================================================== */

    private String extractPythonError(
            RestClientResponseException exception
    ) {

        String body =
                exception.getResponseBodyAsString();

        if (body == null ||
                body.isBlank()) {

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
       RESPONSE TYPES
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
}