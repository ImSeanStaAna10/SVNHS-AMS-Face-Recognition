package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;

import software.amazon.awssdk.services.s3.S3Client;

import com.example.attendancemanagementbackend.dto.SupabaseStorageTestResponse;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.nio.file.Path;

@Service
public class SupabaseStorageService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final S3Client s3Client;

    private final String bucket;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public SupabaseStorageService(

            S3Client s3Client,

            @Value("${supabase.storage.bucket}")
            String bucket
    ) {

        this.s3Client =
                s3Client;

        if (
                bucket == null
                        ||
                        bucket.isBlank()
        ) {

            throw new IllegalStateException(
                    "Supabase Storage bucket is required"
            );
        }

        this.bucket =
                bucket.trim();
    }

    /* =========================================================
       UPLOAD BYTE ARRAY
    ========================================================= */

    public void upload(

            String objectKey,

            byte[] content,

            String contentType
    ) {

        validateObjectKey(
                objectKey
        );

        if (content == null) {

            throw new IllegalArgumentException(
                    "Storage content cannot be null"
            );
        }

        String resolvedContentType =
                contentType == null
                        ||
                        contentType.isBlank()

                        ? "application/octet-stream"

                        : contentType.trim();

        try {

            PutObjectRequest request =
                    PutObjectRequest
                            .builder()

                            .bucket(
                                    bucket
                            )

                            .key(
                                    normalizeObjectKey(
                                            objectKey
                                    )
                            )

                            .contentType(
                                    resolvedContentType
                            )

                            .build();

            s3Client.putObject(
                    request,
                    RequestBody.fromBytes(
                            content
                    )
            );

        } catch (S3Exception exception) {

            throw storageException(
                    "Unable to upload file to Supabase Storage",
                    exception
            );
        }
    }

    /* =========================================================
       UPLOAD LOCAL FILE

       Useful during report migration because PDFBox/POI
       currently generate temporary Path files.
    ========================================================= */

    public void upload(

            String objectKey,

            Path file,

            String contentType
    ) {

        validateObjectKey(
                objectKey
        );

        if (file == null) {

            throw new IllegalArgumentException(
                    "Storage file cannot be null"
            );
        }

        String resolvedContentType =
                contentType == null
                        ||
                        contentType.isBlank()

                        ? "application/octet-stream"

                        : contentType.trim();

        try {

            PutObjectRequest request =
                    PutObjectRequest
                            .builder()

                            .bucket(
                                    bucket
                            )

                            .key(
                                    normalizeObjectKey(
                                            objectKey
                                    )
                            )

                            .contentType(
                                    resolvedContentType
                            )

                            .build();

            s3Client.putObject(
                    request,
                    file
            );

        } catch (S3Exception exception) {

            throw storageException(
                    "Unable to upload file to Supabase Storage",
                    exception
            );
        }
    }

    /* =========================================================
       DOWNLOAD
    ========================================================= */

    public byte[] download(
            String objectKey
    ) {

        validateObjectKey(
                objectKey
        );

        try {

            GetObjectRequest request =
                    GetObjectRequest
                            .builder()

                            .bucket(
                                    bucket
                            )

                            .key(
                                    normalizeObjectKey(
                                            objectKey
                                    )
                            )

                            .build();

            ResponseBytes<GetObjectResponse> response =
                    s3Client
                            .getObjectAsBytes(
                                    request
                            );

            return response
                    .asByteArray();

        } catch (S3Exception exception) {

            if (
                    exception.statusCode()
                            ==
                            HttpStatus.NOT_FOUND.value()
            ) {

                throw new ApiException(
                        HttpStatus.NOT_FOUND,
                        "Attendance report file was not found in storage"
                );
            }

            throw storageException(
                    "Unable to download file from Supabase Storage",
                    exception
            );
        }
    }

    /* =========================================================
       EXISTS
    ========================================================= */

    public boolean exists(
            String objectKey
    ) {

        validateObjectKey(
                objectKey
        );

        try {

            HeadObjectRequest request =
                    HeadObjectRequest
                            .builder()

                            .bucket(
                                    bucket
                            )

                            .key(
                                    normalizeObjectKey(
                                            objectKey
                                    )
                            )

                            .build();

            s3Client.headObject(
                    request
            );

            return true;

        } catch (S3Exception exception) {

            if (
                    exception.statusCode()
                            ==
                            HttpStatus.NOT_FOUND.value()
            ) {

                return false;
            }

            throw storageException(
                    "Unable to check Supabase Storage object",
                    exception
            );
        }
    }

    /* =========================================================
       DELETE
    ========================================================= */

    public void delete(
            String objectKey
    ) {

        validateObjectKey(
                objectKey
        );

        try {

            DeleteObjectRequest request =
                    DeleteObjectRequest
                            .builder()

                            .bucket(
                                    bucket
                            )

                            .key(
                                    normalizeObjectKey(
                                            objectKey
                                    )
                            )

                            .build();

            s3Client.deleteObject(
                    request
            );

        } catch (S3Exception exception) {

            throw storageException(
                    "Unable to delete file from Supabase Storage",
                    exception
            );
        }
    }

    /* =========================================================
       OBJECT KEY VALIDATION
    ========================================================= */

    private void validateObjectKey(
            String objectKey
    ) {

        if (
                objectKey == null
                        ||
                        objectKey.isBlank()
        ) {

            throw new IllegalArgumentException(
                    "Storage object key is required"
            );
        }
    }

    /* =========================================================
       NORMALIZE OBJECT KEY

       S3 keys always use forward slashes.
    ========================================================= */

    private String normalizeObjectKey(
            String objectKey
    ) {

        String normalized =
                objectKey
                        .trim()
                        .replace(
                                '\\',
                                '/'
                        );

        while (
                normalized.startsWith(
                        "/"
                )
        ) {

            normalized =
                    normalized.substring(
                            1
                    );
        }

        return normalized;
    }

    /* =========================================================
       STORAGE ERROR
    ========================================================= */

    private ApiException storageException(

            String message,

            S3Exception exception
    ) {

        String detail =
                exception.awsErrorDetails() != null
                        &&
                        exception
                                .awsErrorDetails()
                                .errorMessage() != null

                        ? exception
                        .awsErrorDetails()
                        .errorMessage()

                        : exception.getMessage();

        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                message
                        +
                        (
                                detail == null
                                        ||
                                        detail.isBlank()

                                        ? ""

                                        : ": " + detail
                        )
        );
    }


    /* =========================================================
   STORAGE SMOKE TEST

   Tests:
   1. upload
   2. exists
   3. download
   4. delete
   5. confirm deletion
========================================================= */

    public SupabaseStorageTestResponse smokeTest() {

        String objectKey =
                "_health/"
                        +
                        UUID.randomUUID()
                        +
                        ".txt";

        byte[] expected =
                "SVNHS Supabase Storage connection test"
                        .getBytes(
                                StandardCharsets.UTF_8
                        );

        upload(
                objectKey,
                expected,
                "text/plain"
        );

        boolean uploadVerified =
                exists(
                        objectKey
                );

        byte[] downloaded =
                download(
                        objectKey
                );

        boolean downloadVerified =
                java.util.Arrays.equals(
                        expected,
                        downloaded
                );

        delete(
                objectKey
        );

        boolean deleteVerified =
                !exists(
                        objectKey
                );

        return new SupabaseStorageTestResponse(

                uploadVerified
                        &&
                        downloadVerified
                        &&
                        deleteVerified,

                bucket,

                objectKey,

                uploadVerified,

                downloadVerified,

                deleteVerified
        );
    }
}