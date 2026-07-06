package com.kagein.springbff.repository;

import com.kagein.springbff.domain.PersonLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PersonLocationRepository extends JpaRepository<PersonLocation, Long> {
    List<PersonLocation> findTop50ByPersonIdOrderByCapturedAtDesc(Long personId);
}
