package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceRecordResponse;
import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public class AttendanceRecordService {

    private static final double FACE_MATCH_THRESHOLD = 0.50;

    private final AttendanceRecordRepository attendanceRecordRepository;
    private final AttendanceSessionRepository attendanceSessionRepository;
    private final StudentRepository studentRepository;
    private final StudentFaceService studentFaceService;
    private final FaceRecognitionClient faceRecognitionClient;

    public AttendanceRecordService(
            AttendanceRecordRepository attendanceRecordRepository,
            AttendanceSessionRepository attendanceSessionRepository,
            StudentRepository studentRepository,
            StudentFaceService studentFaceService,
            FaceRecognitionClient faceRecognitionClient
    ) {
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.attendanceSessionRepository = attendanceSessionRepository;
        this.studentRepository = studentRepository;
        this.studentFaceService = studentFaceService;
        this.faceRecognitionClient = faceRecognitionClient;
    }

    @Transactional
    public AttendanceRecord markPresent(
            String sessionId,
            String studentId
    ) {

        AttendanceSession session =
                getActiveSession(sessionId);

        Student student =
                studentRepository.findById(studentId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        return createAttendanceRecord(
                session,
                student
        );
    }

    @Transactional
    public AttendanceRecord markPresentByFace(
            String sessionId,
            MultipartFile image
    ) throws IOException {

        AttendanceSession session =
                getActiveSession(sessionId);

        if (image == null || image.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        FaceRecognitionClient.FaceRecognitionResult result =
                faceRecognitionClient.recognizeFace(
                        image.getBytes(),
                        image.getOriginalFilename()
                );

        if (result == null ||
                !result.success() ||
                result.embedding() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face recognition failed"
            );
        }

        FaceMatchResult match =
                studentFaceService.findMostSimilarFace(
                        result.embedding()
                );

        if (match.distance() > FACE_MATCH_THRESHOLD) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        Student student =
                studentRepository.findById(
                                match.studentId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        return createAttendanceRecord(
                session,
                student
        );
    }

    private AttendanceSession getActiveSession(
            String sessionId
    ) {

        AttendanceSession session =
                attendanceSessionRepository.findById(sessionId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance session not found"
                                )
                        );

        if (session.getStatus() !=
                AttendanceSessionStatus.ACTIVE) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session is not active"
            );
        }

        return session;
    }

    private AttendanceRecord createAttendanceRecord(
            AttendanceSession session,
            Student student
    ) {

        if (student.getSection() == null ||
                session.getSection() == null ||
                !student.getSection()
                        .getId()
                        .equals(session.getSection().getId())) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Student does not belong to this section"
            );
        }

        if (attendanceRecordRepository
                .existsBySessionIdAndStudentId(
                        session.getId(),
                        student.getId()
                )) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student already has an attendance record for this session"
            );
        }

        AttendanceRecord record =
                new AttendanceRecord(
                        session,
                        student
                );

        return attendanceRecordRepository.save(record);
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> getSessionRecords(
            String sessionId
    ) {

        if (!attendanceSessionRepository.existsById(sessionId)) {
            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance session not found"
            );
        }

        return attendanceRecordRepository
                .findBySessionId(sessionId)
                .stream()
                .map(record ->
                        new AttendanceRecordResponse(
                                record.getId(),
                                record.getSession().getId(),
                                record.getStudent().getId(),
                                record.getStudent().getStudentNumber(),
                                record.getStudent().getName(),
                                record.getRecordedAt(),
                                record.getStatus().name()
                        )
                )
                .toList();
    }

    @Transactional
    public void deleteAttendanceRecord(
            String sessionId,
            String studentId
    ) {

        AttendanceRecord record =
                attendanceRecordRepository
                        .findBySessionIdAndStudentId(
                                sessionId,
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance record not found"
                                )
                        );

        attendanceRecordRepository.delete(record);
    }
}