package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PointOfInterestRepositoryTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private PointOfInterestRepository pointRepository;

    @Autowired
    private FmAccountRepository fmAccountRepository;

    @Test
    void findsPointsByAccount() {
        FmAccount account = fmAccountRepository.save(FmAccount.builder()
                .appleId("a@icloud.com").encryptedPassword("x")
                .status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
        pointRepository.save(PointOfInterest.builder()
                .fmAccountId(account.getId()).label("Home")
                .latitude(-23.56).longitude(-46.65).createdAt(Instant.now()).build());

        List<PointOfInterest> found = pointRepository.findByFmAccountId(account.getId());

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getLabel()).isEqualTo("Home");
    }
}
