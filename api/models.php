<?php
namespace MailerAPI;

define( 'REDBEAN_MODEL_PREFIX', '\\MailerAPI\\' );

class User extends \RedBeanPHP\SimpleModel
{
  public function getDetails() {
    return [
      "id" => $this->bean->id,
      'name' => $this->bean->name,
      'email' => $this->bean->email
    ];
  }
}

class Apikey extends \RedBeanPHP\SimpleModel
{
  public function getDetails(){
    return [
      'id' => $this->bean->id,
      'name' => $this->bean->name
    ];
  }
}
