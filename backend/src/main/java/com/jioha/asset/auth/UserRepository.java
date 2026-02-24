package com.jioha.asset.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

  Optional<UserEntity> findByEmailNormalized(String emailNormalized);

  boolean existsByEmailNormalized(String emailNormalized);
}
