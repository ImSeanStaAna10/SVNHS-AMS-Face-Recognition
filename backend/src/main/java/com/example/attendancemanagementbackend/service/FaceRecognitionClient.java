package com.example.attendancemanagementbackend.service;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class FaceRecognitionClient {

    private final RestClient restClient;

    public FaceRecognitionClient() {
        this.restClient = RestClient.builder()
                .baseUrl("http://localhost:8001")
                .build();
    }

    public FaceEnrollmentResult enrollFace(
            String studentId,
            byte[] imageBytes,
            String filename
    ) {

        ByteArrayResource imageResource =
                new ByteArrayResource(imageBytes) {

                    @Override
                    public String getFilename() {
                        return filename;
                    }
                };

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("student_id", studentId);
        body.add("image", imageResource);

        return restClient.post()
                .uri("/enrollment")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(FaceEnrollmentResult.class);
    }

    public FaceRecognitionResult recognizeFace(
            byte[] imageBytes,
            String filename
    ) {

        ByteArrayResource imageResource =
                new ByteArrayResource(imageBytes) {

                    @Override
                    public String getFilename() {
                        return filename;
                    }
                };

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("image", imageResource);

        return restClient.post()
                .uri("/recognize")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(FaceRecognitionResult.class);
    }

    public record FaceEnrollmentResult(
            boolean success,
            String student_id,
            java.util.List<Double> embedding
    ) {
    }

    public record FaceRecognitionResult(
            boolean success,
            java.util.List<Double> embedding
    ) {
    }
}