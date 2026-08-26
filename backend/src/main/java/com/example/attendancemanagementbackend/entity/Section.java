package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "sections")
public class Section {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    /* =========================================================
       DEPARTMENT

       Nullable muna habang ginagawa natin ang migration.

       Example:
       ICT Section
       → department = ICT

       TVL Section
       → department = TVL

       Direct relationship ito para kahit temporarily
       walang adviser ang section, alam pa rin natin
       kung anong department siya belongs to.
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "department_id"
    )
    private Department department;

    /* =========================================================
       ADVISER
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "adviser_id")
    private User adviser;

    @Column(nullable = false)
    private boolean active = true;

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public Section() {
    }

    /*
     * Existing constructor retained.
     *
     * Current code using:
     *
     * new Section(name, adviser)
     *
     * will continue working.
     */
    public Section(
            String name,
            User adviser
    ) {
        this.name = name;
        this.adviser = adviser;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /* =========================================================
       GETTERS / SETTERS
    ========================================================= */

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(
            Department department
    ) {
        this.department = department;
    }

    public User getAdviser() {
        return adviser;
    }

    public void setAdviser(
            User adviser
    ) {
        this.adviser = adviser;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(
            boolean active
    ) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(
            LocalDateTime updatedAt
    ) {
        this.updatedAt = updatedAt;
    }
}