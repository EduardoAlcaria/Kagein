package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "zone")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Zone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "poi_id", nullable = false)
    private Long poiId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ZoneShape shape;

    @Column(name = "radius_meters")
    private Integer radiusMeters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String vertices;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ZoneTrigger trigger;

    @Column(nullable = false)
    private String color;

    @Column(name = "alarm_message", nullable = false)
    private String alarmMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
