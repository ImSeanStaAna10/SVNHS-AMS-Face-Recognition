package com.example.attendancemanagementbackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

import software.amazon.awssdk.regions.Region;

import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
public class SupabaseStorageConfig {

    /* =========================================================
       S3 CLIENT

       Supabase Storage exposes an S3-compatible endpoint.

       Important:
       - credentials stay server-side
       - custom endpoint is required
       - project region is required for request signing
       - path-style access is required by Supabase S3
    ========================================================= */

    @Bean
    public S3Client supabaseS3Client(

            @Value("${supabase.storage.endpoint}")
            String endpoint,

            @Value("${supabase.storage.region}")
            String region,

            @Value("${supabase.storage.access-key}")
            String accessKey,

            @Value("${supabase.storage.secret-key}")
            String secretKey
    ) {

        validateRequired(
                "supabase.storage.endpoint",
                endpoint
        );

        validateRequired(
                "supabase.storage.region",
                region
        );

        validateRequired(
                "supabase.storage.access-key",
                accessKey
        );

        validateRequired(
                "supabase.storage.secret-key",
                secretKey
        );

        AwsBasicCredentials credentials =
                AwsBasicCredentials.create(
                        accessKey.trim(),
                        secretKey.trim()
                );

        return S3Client
                .builder()

                .endpointOverride(
                        URI.create(
                                endpoint.trim()
                        )
                )

                .region(
                        Region.of(
                                region.trim()
                        )
                )

                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                credentials
                        )
                )

                /*
                 * Supabase's official S3 examples use
                 * forcePathStyle=true.
                 */
                .forcePathStyle(
                        true
                )

                .build();
    }

    /* =========================================================
       CONFIG VALIDATION
    ========================================================= */

    private void validateRequired(

            String property,

            String value
    ) {

        if (
                value == null
                        ||
                        value.isBlank()
        ) {

            throw new IllegalStateException(
                    "Missing required configuration: "
                            +
                            property
            );
        }
    }
}