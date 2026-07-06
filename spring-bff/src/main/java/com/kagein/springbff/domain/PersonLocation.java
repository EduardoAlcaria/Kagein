package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "person_location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "person_id", nullable = false)
    private Long personId;

    private Double latitude;

    private Double longitude;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
}
