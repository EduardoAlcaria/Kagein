// spring-bff/src/test/java/com/kagein/springbff/repository/FmAccountRepositoryTest.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import org.junit.jupiter.api.Test;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FmAccountRepositoryTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @org.springframework.beans.factory.annotation.Autowired
    private FmAccountRepository repository;

    @Test
    void savesAndFindsByAppleId() {
        FmAccount account = FmAccount.builder()
                .appleId("user@example.com")
                .encryptedPassword("encrypted-blob")
                .status(AccountStatus.PENDING_2FA)
                .createdAt(Instant.now())
                .build();
        repository.save(account);

        Optional<FmAccount> found = repository.findByAppleId("user@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(AccountStatus.PENDING_2FA);
    }
}
