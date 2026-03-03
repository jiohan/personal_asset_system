package com.jioha.asset.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ApiExceptionHandlerTest.ThrowingController.class)
@Import(ApiExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class ApiExceptionHandlerTest {

  @Autowired
  MockMvc mvc;

  @Test
  void unexpectedException_returnsInternalErrorResponse() throws Exception {
    mvc.perform(get("/test/boom"))
        .andExpect(status().isInternalServerError())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
        .andExpect(jsonPath("$.error.message").value("Internal server error."));
  }

  @RestController
  static class ThrowingController {
    @GetMapping("/test/boom")
    String boom() {
      throw new IllegalStateException("boom");
    }
  }
}
