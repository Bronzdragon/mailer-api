<?php
namespace MailerAPI;

define( 'REDBEAN_MODEL_PREFIX', '\\MailerAPI\\' );

class User extends \RedBeanPHP\SimpleModel
{
  public function getDetails(bool $includeLists = false, bool $includeKeys = false) {
    $returnValue = [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name,
      'email' => $this->bean->email
    ];

    if ($includeKeys) {
      $returnValue['keys'] = [];
      foreach ($this->bean->xownApikeyList as $key) {
        $returnValue['keys'][] = $key->getDetails();
      }
    }
    if ($includeLists) {
      $returnValue['mailinglists'] = [];
      foreach ($this->bean->xownMailinglistList as $list) {
        $returnValue['mailinglists'][] = $list->getDetails(false);
      }
    }
    return $returnValue;
  }
}

class apikey extends \RedBeanPHP\SimpleModel
{
  public function getDetails(){
    return [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name
    ];
  }
}

class mailinglist extends \RedBeanPHP\SimpleModel
{
  public function getDetails(bool $includeSubs = false){
    $returnValue = [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name,
    ];

    if($includeSubs){
      // Ensure there is an array, even if there are no subscribers.
      $returnValue['subscribers'] = [];
      foreach ($this->bean->xownSubscriberList as $subscriber) {
        $returnValue['subscribers'][] = $subscriber->getDetails(false);
      }
    }

    return $returnValue;
  }
}

class subscriber extends \RedBeanPHP\SimpleModel
{
  public function getDetails(bool $includeFields = false)
  {
    $returnValue = [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name,
      'email' => $this->bean->email,
      'state' => $this->bean->state,
    ];

    if($includeFields){
      // Ensure there is an array, even if there are no fields.
      $returnValue['fields'] = [];
      foreach ($this->bean->xownFieldList as $field) {
        $returnValue['fields'][] = $field->getDetails();
      }
    }
    return $returnValue;
  }
}

class field extends \RedBeanPHP\SimpleModel
{
  public function getDetails(){
    $value;
    switch ($this->bean->type) {
      case 'boolean':
        $value = ($this->bean->value === "true"); // Convert back to boolean
        break;
      case 'number':
        $value = floatval($this->bean->value);
        break;
      case 'text': // falls through intentionally
      default: // If it's somehow not one of these values, let's just output the value as is.
        $value = $this->bean->value;
        break;
    }

    return [
      'name' => $this->bean->name,
      'value' => $value
    ];
  }
}
