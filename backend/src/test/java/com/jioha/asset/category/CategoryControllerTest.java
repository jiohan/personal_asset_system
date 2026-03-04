package com.jioha.asset.category;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.flyway.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:asset_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driverClassName=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.session.store-type=jdbc",
    "spring.session.jdbc.initialize-schema=always"
})
@AutoConfigureMockMvc
class CategoryControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Autowired
  JdbcTemplate jdbcTemplate;

  @Test
  void create_list_patch_userCategory_success() throws Exception {
    SessionContext me = signupAndLogin();

    long categoryId = createCategory(me, "EXPENSE", "Food", null);

    MvcResult list = mvc.perform(get("/api/v1/categories")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andReturn();

    List<Long> ids = objectMapper.readTree(list.getResponse().getContentAsString())
        .path("items")
        .findValuesAsText("id")
        .stream()
        .map(Long::parseLong)
        .toList();
    assertThat(ids).contains(categoryId);

    mvc.perform(patch("/api/v1/categories/{id}", categoryId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("name", "Dining"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Dining"));
  }

  @Test
  void patch_systemCategory_conflict() throws Exception {
    SessionContext me = signupAndLogin();

    jdbcTemplate.update(
        """
            insert into categories(user_id, type, name, name_normalized, parent_id, is_active, order_index)
            values (null, 'EXPENSE', 'System', 'system', null, true, null)
            """);
    Long systemCategoryId = jdbcTemplate.queryForObject(
        "select id from categories where user_id is null and name = 'System'",
        Long.class);

    mvc.perform(patch("/api/v1/categories/{id}", systemCategoryId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("name", "Blocked"))))
        .andExpect(status().isConflict());
  }

  @Test
  void create_grandchildCategory_validationError() throws Exception {
    SessionContext me = signupAndLogin();

    long rootId = createCategory(me, "EXPENSE", "Root", null);
    long childId = createCategory(me, "EXPENSE", "Child", rootId);

    mvc.perform(post("/api/v1/categories")
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "type", "EXPENSE",
                "name", "Grandchild",
                "parentId", childId
            ))))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
  }

  @Test
  void patch_parentId_omittedKeepsButNullClears() throws Exception {
    SessionContext me = signupAndLogin();

    long parentId = createCategory(me, "EXPENSE", "Parent", null);
    long childId = createCategory(me, "EXPENSE", "Child", parentId);

    mvc.perform(patch("/api/v1/categories/{id}", childId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("name", "Child-Renamed"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Child-Renamed"))
        .andExpect(jsonPath("$.parentId").value(parentId));

    mvc.perform(patch("/api/v1/categories/{id}", childId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"parentId\":null}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.parentId").isEmpty());
  }

  @Test
  void patch_otherUsersCategory_notFound() throws Exception {
    SessionContext me = signupAndLogin();
    SessionContext other = signupAndLogin();
    long categoryId = createCategory(me, "EXPENSE", "Private", null);

    mvc.perform(patch("/api/v1/categories/{id}", categoryId)
            .cookie(other.sessionCookie, other.xsrfCookie)
            .header("X-XSRF-TOKEN", other.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("name", "Hacked"))))
        .andExpect(status().isNotFound());
  }

  private long createCategory(SessionContext session, String type, String name, Long parentId) throws Exception {
    String payload = parentId == null
        ? objectMapper.writeValueAsString(Map.of("type", type, "name", name))
        : objectMapper.writeValueAsString(Map.of("type", type, "name", name, "parentId", parentId));

    MvcResult res = mvc.perform(post("/api/v1/categories")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isCreated())
        .andReturn();

    return objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asLong();
  }

  private SessionContext signupAndLogin() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    MvcResult signup = mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated())
        .andReturn();

    jakarta.servlet.http.Cookie sessionCookie =
        new jakarta.servlet.http.Cookie("JSESSIONID", signup.getResponse().getCookie("JSESSIONID").getValue());

    return new SessionContext(sessionCookie, xsrfCookie, xsrf);
  }

  private record SessionContext(
      jakarta.servlet.http.Cookie sessionCookie,
      jakarta.servlet.http.Cookie xsrfCookie,
      String xsrf
  ) {
  }
}
