    package com.example.attendancemanagementbackend.service;
    
    import com.example.attendancemanagementbackend.dto.AuthResponse;
    import com.example.attendancemanagementbackend.dto.LoginRequest;
    import com.example.attendancemanagementbackend.dto.RegisterRequest;
    import com.example.attendancemanagementbackend.entity.Role;
    import com.example.attendancemanagementbackend.entity.User;
    import com.example.attendancemanagementbackend.exception.ApiException;
    import com.example.attendancemanagementbackend.repository.UserRepository;
    import org.springframework.http.HttpStatus;
    import org.springframework.security.crypto.password.PasswordEncoder;
    import org.springframework.stereotype.Service;
    
    @Service
    public class AuthService {
    
        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final JwtService jwtService;
    
        public AuthService(
                UserRepository userRepository,
                PasswordEncoder passwordEncoder,
                JwtService jwtService
        ) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.jwtService = jwtService;
        }
    
        /**
         * Register a new adviser account.
         */
        public User register(
                RegisterRequest request
        ) {
    
            // Prevent duplicate email
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Email already exists"
                );
            }
    
            String hashedPassword =
                    passwordEncoder.encode(
                            request.getPassword()
                    );
    
            User user = new User(
                    request.getName(),
                    request.getEmail(),
                    hashedPassword,
                    Role.ADVISER
            );
    
            return userRepository.save(user);
        }
    
        /**
         * Login user.
         */
        public AuthResponse login(
                LoginRequest request
        ) {
    
            User user =
                    userRepository.findByEmail(
                                    request.getEmail()
                            )
                            .orElseThrow(() ->
                                    new ApiException(
                                            HttpStatus.UNAUTHORIZED,
                                            "Invalid email or password"
                                    )
                            );
    
            // Block inactive users
            if (!user.isActive()) {
                throw new ApiException(
                        HttpStatus.FORBIDDEN,
                        "User account is inactive"
                );
            }
    
            // Validate password
            if (!passwordEncoder.matches(
                    request.getPassword(),
                    user.getPassword()
            )) {
    
                throw new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"
                );
            }
    
            String token =
                    jwtService.generateToken(user);
    
            return new AuthResponse(
                    "Login successful",
                    token,
                    user.getId(),
                    user.getName(),
                    user.getEmail(),
                    user.getRole()
            );
        }
    
        /**
         * Find user by email.
         */
        public User findUserByEmail(
                String email
        ) {
    
            return userRepository
                    .findByEmail(email)
                    .orElseThrow(() ->
                            new ApiException(
                                    HttpStatus.NOT_FOUND,
                                    "User not found"
                            )
                    );
        }
    }