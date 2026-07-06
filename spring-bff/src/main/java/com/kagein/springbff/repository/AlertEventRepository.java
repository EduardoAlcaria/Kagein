package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AlertEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertEventRepository extends JpaRepository<AlertEvent, Long> {
    List<AlertEvent> findTop100ByOrderByTriggeredAtDesc();
}
