package com.kagein.springbff.repository;

import com.kagein.springbff.domain.PointOfInterest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PointOfInterestRepository extends JpaRepository<PointOfInterest, Long> {
    List<PointOfInterest> findByFmAccountId(Long fmAccountId);
}
