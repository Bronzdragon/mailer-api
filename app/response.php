<?php
namespace MailerAPI;

class Response
{
  public $headers;
  public $body;
  public $responseCode;

  public function __construct() {
    $this->headers = [];
    $this->body = new \stdClass;
    $this->code = 200;
  }

  public function BodyToJson()
  {
    return json_encode($this->body, JSON_PRETTY_PRINT + JSON_UNESCAPED_SLASHES);
  }
}
?>
