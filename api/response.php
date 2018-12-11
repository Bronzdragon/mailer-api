<?php
namespace MailerAPI;

class Response
{
  public $headers;
  public $body;
  public $responseCode;

  public function __construct(int $code = 500, array $body = null, array $headers = []) {
    $this->code = $code;
    $this->headers = $headers;
    $this->body = $body;
  }

  public function BodyToJson() {
    return json_encode($this->body, JSON_PRETTY_PRINT + JSON_UNESCAPED_SLASHES);
  }
}
