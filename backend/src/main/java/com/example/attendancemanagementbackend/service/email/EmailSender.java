package com.example.attendancemanagementbackend.service.email;

public interface EmailSender {

    /**
     * Sends one email message.
     *
     * Implementations should throw an exception
     * when the provider does not accept the request.
     */
    void send(
            EmailMessage message
    );
}