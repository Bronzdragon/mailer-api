<?php
namespace MailerAPI;

class Response
{
  public $headers;
  public $body;

  public function __construct() {
    $this->headers = ["http_response_code" => 200];
    $this->body = new \stdClass;
  }

  public function BodyToJson()
  {
    return json_encode($this->body, JSON_PRETTY_PRINT + JSON_UNESCAPED_SLASHES);
  }
}
?>
