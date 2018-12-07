<?php
namespace MailerAPI;

class Response
{
  public $headers;
  public $body;
  public $responseCode;

  public function __construct() {
    $this->code = 200;
    $this->body = [];
  }

  public function BodyToJson()
  {
    return json_encode($this->body, JSON_PRETTY_PRINT + JSON_UNESCAPED_SLASHES);
  }
}
?>
