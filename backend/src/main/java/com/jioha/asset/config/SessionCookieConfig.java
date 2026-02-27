package com.jioha.asset.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionCookieConfig {

  @Bean
  public CookieSerializer cookieSerializer() {
    // Slice1 hardening: Spring Session defaults to cookie name "SESSION"; align to contract "JSESSIONID".
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName("JSESSIONID");
    serializer.setCookiePath("/");
    return serializer;
  }
}
