package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FmAccountRepository extends JpaRepository<FmAccount, Long> {
    Optional<FmAccount> findByAppleId(String appleId);
    List<FmAccount> findByStatus(AccountStatus status);
}
