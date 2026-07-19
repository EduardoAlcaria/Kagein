package com.kagein.springbff.repository;

import com.kagein.springbff.domain.Zone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ZoneRepository extends JpaRepository<Zone, Long> {
    List<Zone> findByPoiIdIn(List<Long> poiIds);
}
