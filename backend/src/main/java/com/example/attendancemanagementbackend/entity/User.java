package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private boolean active = true;

    /* =========================================================
       DEPARTMENT

       Nullable muna para hindi masira ang existing users
       habang nagmi-migrate tayo to department-scoped Councilors.

       Examples:

       ICT Department Councilor
       → department = ICT

       TVL Department Councilor
       → department = TVL

       ICT Adviser
       → department = ICT
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "department_id"
    )
    private Department department;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public User() {
    }

    /*
     * Existing constructor retained.
     *
     * Important:
     * Current code that creates Users / Advisers using:
     *
     * new User(name, email, password, role)
     *
     * will continue working.
     */
    public User(
            String name,
            String email,
            String password,
            Role role
    ) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(
            String email
    ) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(
            String password
    ) {
        this.password = password;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(
            Role role
    ) {
        this.role = role;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(
            boolean active
    ) {
        this.active = active;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(
            Department department
    ) {
        this.department = department;
    }
}