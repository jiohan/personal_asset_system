package com.jioha.asset.category;

import com.jioha.asset.domain.TransactionType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<CategoryEntity, Long> {

  Optional<CategoryEntity> findByIdAndUserId(Long id, Long userId);

  /**
   * Returns categories accessible to a user, including global system categories (userId is null).
   * This query does not apply isActive filtering.
   */
  @Query("""
      select c
      from CategoryEntity c
      where (c.userId = :userId or c.userId is null)
        and (:type is null or c.type = :type)
      order by c.type asc,
               case when c.parentId is null then 0 else 1 end,
               c.parentId asc,
               case when c.orderIndex is null then 1 else 0 end,
               c.orderIndex asc,
               c.id asc
      """)
  List<CategoryEntity> findAccessibleForUser(@Param("userId") Long userId, @Param("type") TransactionType type);

  /**
   * Returns a category accessible to a user, including global system categories (userId is null).
   * This query does not apply isActive filtering.
   */
  @Query("""
      select c
      from CategoryEntity c
      where c.id = :id
        and (c.userId = :userId or c.userId is null)
      """)
  Optional<CategoryEntity> findAccessibleById(@Param("id") Long id, @Param("userId") Long userId);
}
