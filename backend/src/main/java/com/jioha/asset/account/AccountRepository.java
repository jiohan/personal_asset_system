package com.jioha.asset.account;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<AccountEntity, Long> {

  Optional<AccountEntity> findByIdAndUserId(Long id, Long userId);

  @Query("""
      select a
      from AccountEntity a
      where a.userId = :userId
      order by case when a.orderIndex is null then 1 else 0 end,
               a.orderIndex asc,
               a.id asc
      """)
  List<AccountEntity> findAllByUserIdOrderForList(@Param("userId") Long userId);
}
