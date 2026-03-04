package com.jioha.asset.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
class AccountControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Test
  void list_create_patch_forOwnUser_succeeds_and_usesStableOrder() throws Exception {
    SessionContext me = signupAndLogin();

    long nullOrderId = createAccount(me, "Wallet", "CASH", null, 1500, true);
    long firstOrderId = createAccount(me, "Main", "CHECKING", 5, 2000, true);
    long secondOrderId = createAccount(me, "Reserve", "SAVINGS", 5, 3000, true);

    mvc.perform(patch("/api/v1/accounts/{id}", firstOrderId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "isActive", false,
                "name", "Main Archived"
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(firstOrderId))
        .andExpect(jsonPath("$.name").value("Main Archived"))
        .andExpect(jsonPath("$.isActive").value(false));

    MvcResult list = mvc.perform(get("/api/v1/accounts")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(3))
        .andReturn();

    JsonNode items = objectMapper.readTree(list.getResponse().getContentAsString()).path("items");
    assertThat(items.get(0).path("id").asLong()).isEqualTo(firstOrderId);
    assertThat(items.get(1).path("id").asLong()).isEqualTo(secondOrderId);
    assertThat(items.get(2).path("id").asLong()).isEqualTo(nullOrderId);
    assertThat(items.get(0).path("currentBalance").asLong()).isEqualTo(2000L);
  }

  @Test
  void patch_otherUsersAccount_returnsNotFound() throws Exception {
    SessionContext owner = signupAndLogin();
    SessionContext other = signupAndLogin();

    long accountId = createAccount(owner, "Owner Account", "CHECKING", 1, 1000, true);

    mvc.perform(patch("/api/v1/accounts/{id}", accountId)
            .cookie(other.sessionCookie, other.xsrfCookie)
            .header("X-XSRF-TOKEN", other.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("name", "Hacked"))))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
  }

  @Test
  void list_onlyReturnsCurrentUsersAccounts() throws Exception {
    SessionContext owner = signupAndLogin();
    SessionContext other = signupAndLogin();

    createAccount(owner, "Owner Account", "CHECKING", 1, 1000, true);
    createAccount(other, "Other Account", "CHECKING", 1, 1000, true);

    mvc.perform(get("/api/v1/accounts")
            .cookie(owner.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].name").value("Owner Account"));

    mvc.perform(get("/api/v1/accounts")
            .cookie(other.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].name").value("Other Account"));
  }

  private long createAccount(SessionContext session, String name, String type, Integer orderIndex,
      long openingBalance, boolean isActive) throws Exception {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", name);
    payload.put("type", type);
    payload.put("openingBalance", openingBalance);
    payload.put("isActive", isActive);
    if (orderIndex != null) {
      payload.put("orderIndex", orderIndex);
    }

    MvcResult res = mvc.perform(post("/api/v1/accounts")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)))
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
