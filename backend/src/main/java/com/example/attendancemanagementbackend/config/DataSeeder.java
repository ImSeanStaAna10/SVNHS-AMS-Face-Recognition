package com.example.attendancemanagementbackend.config;

import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedCouncilor(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {

            if (userRepository.existsByEmail("councilor@attendance.com")) {
                return;
            }

            String password = passwordEncoder.encode("councilor123");

            User councilor = new User(
                    "System Councilor",
                    "councilor@attendance.com",
                    password,
                    Role.COUNCILOR
            );

            userRepository.save(councilor);

            System.out.println("Initial Councilor account created.");
        };
    }
}