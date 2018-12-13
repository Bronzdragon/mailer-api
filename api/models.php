<?php
namespace MailerAPI;
require_once 'rb.php'; //RedBeanPHP
require_once 'response.php';
use R;

define( 'REDBEAN_MODEL_PREFIX', '\\MailerAPI\\' );

class user extends \RedBeanPHP\SimpleModel {
  public function getDetails(bool $includeLists = false, bool $includeKeys = false): array {
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

  public function updateDetails(string $name = null, string $email = null): Response {
    $this->bean->name = $name;
    $this->bean->email = $email;

    R::store($this->bean);
    return new Response(200);
  }

  public function getAPIKey(int $keyId): ?apikey {
    $key = reset($this->bean->withCondition(' id = ? ', [$keyId])->xownApikeyList);
    return ($key !== false ? $key->box() : null);
  }

  public function addAPIKey(string $name = 'default', int $id = 0): Response {
    $apiKey = reset($this->bean->withCondition(' name = ? ', [$name])->xownApikeyList);
    if ($apiKey !== false) {
      return new Response(400, [ 'error' => 'API key with this name already exists.']);
    }

    if (!empty($id) && R::load('apikey', $id)->id !== 0) {
      return new Response(400, [ 'error' => 'Invalid ID.']);
    }

    $rawKey = apikey::generatePasskey();

    $apiKey = R::dispense('apikey');
    $apiKey->id = $id;
    $apiKey->hash = password_hash($rawKey, PASSWORD_BCRYPT);
    $apiKey->name = $name;
    $this->bean->noLoad()->xownApikeyList[] = $apiKey;

    R::store($this->bean);

    return new Response(201, [
      'message' => 'API key created.',
      'key' => $apiKey->getDetails() + ['secret' => $rawKey]
    ]);
  }

  public function getMailinglist(int $listId): ?mailinglist {
    $list = reset($this->bean->withCondition(' id = ? ', [$listId])->xownMailinglistList);
    return ($list !== false ? $list->box() : null);
  }

  public function addMailinglist(string $name, array $subscribers = null, int $id = 0): Response{
    $list = reset($this->bean->withCondition(' name = ? ', [$name])->xownMailinglistList);
    if ($list !== false) {
      return new Response(400, [ 'error' => 'Mailing list with this name already exists.']);
    }

    if (!empty($id) && R::load('mailinglist', $id)->id !== 0) {
      return new Response(400, [ 'error' => 'Invalid ID.']);
    }

    $list = R::dispense('mailinglist');
    $list->id = $id;
    $list->name = $name;


    if (!empty($subscribers)) {
      foreach ($subscribers as $subscriber) {
        if (!isset($subscriber['name']) || !isset($subscriber['email']) || !isset($subscriber['state'])) { continue; }
        $fields = isset($subscriber['fields']) ? $subscriber['fields'] : null;
        $list->addSubscriber($subscriber['name'], $subscriber['email'], $subscriber['state'], $fields);
      }
    }

    $this->bean->noLoad()->xownMailinglistList[] = $list;
    R::store($this->bean);

    return new Response(201, $list->getDetails());
  }

  public function deleteUser(bool $confirm = false): Response {
    if (!$confirm) {
      return new Response(400, ['message' => "The 'confirmDelete' flag was not set."]);
    }
    R::trash($this->bean);
    return new Response(200);
  }

  public static function createUser(string $name, string $email): Response {
    if (!is_null(R::findOne('user', ' email = ?', [$email]))) {
      return new Response(400, ["error" => "User with this email address is already registered."]);
    }

    $user = R::dispense('user');
    $user->updateDetails($name, $email);

    $response = $user->addAPIKey('master');
    $response->body = $user->getDetails() + ['message' => 'User created.'] + $response->body;
    return $response;
  }

  public static function getAuthenticatedUser(array $headers = []): ?user {
    if (!isset($headers['Email']) || !isset($headers["Apikey"])) {
      return NULL;
    }
    $email = $headers['Email'];
    $apiRaw = $headers["Apikey"];
    $user = R::findOne('user', ' email = ? ', [$email]);
    if (is_null($user)) { return NULL; }

    foreach ($user->xownApikeyList as $apiKey) {
      if (password_verify($apiRaw, $apiKey->hash)) {
        return $user->box();
      }
    }
    return null;
  }
}

class apikey extends \RedBeanPHP\SimpleModel {
  public function getDetails(): array {
    return [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name
    ];
  }

  public function updateDetails(string $name = null): Response {
    $this->bean->name = $name;
    R::store($this->bean);
    return new Response(200);
  }

  public function deleteKey(): Response {
    R::trash($this->bean);
    return new Response(200);
  }

  private static function getRandomBytes(int $nbBytes = 32): string {
    $bytes = openssl_random_pseudo_bytes($nbBytes, $strong);
    if ($bytes !== false &&  $strong === true) {
      return $bytes;
    } else {
      throw new \Exception("Unable to generate secure token from OpenSSL.");
    }
  }

  public static function generatePasskey(int $length = 32): string {
    $password = preg_replace("/[^a-zA-Z0-9]/", "", base64_encode(apikey::getRandomBytes($length+1)));
    return strlen($password) >= $length
      ? substr($password, 0, $length)
      : $password . apikey::generatePasskey($length - strlen($password));
  }
}

class mailinglist extends \RedBeanPHP\SimpleModel {
  public function getDetails(bool $includeSubs = false): array {
    $returnValue = [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name,
    ];

    if($includeSubs) {
      // Ensure there is an array, even if there are no subscribers.
      $returnValue['subscribers'] = [];
      foreach ($this->bean->xownSubscriberList as $subscriber) {
        $returnValue['subscribers'][] = $subscriber->getDetails(true);
      }
    } else {
      $returnValue['subscribers'] = count($this->bean->xownSubscriberList);
    }

    return $returnValue;
  }

  public function updateDetails(string $name, array $subscribers = null, bool $clearSubscribers = false): Response {
    $this->bean->name = $name;

    if (!empty($subscribers)) {
      return $this->setSubscribers($subscribers, $clearSubscribers);
    }

    R::store($this->bean);
    return new Response(200);
  }

  private function setSubscribers(array $subscribers, bool $clearSubscribers = false): void {
    if ($clearSubscribers) {
      $this->bean->noLoad()->xownSubscriberList = [];
    }

    // Try to find and update the subscriber.
    foreach ($subscribers as $subscriberInfo) {
      if (!isset($subscriberInfo['id']) || !isset($subscriberInfo['email'])) { continue; }

      if (isset($subscriberInfo['id'])) {
        if ($subscriber = reset($this->bean->withCondition(' id = ? ', [$subscriberInfo['id']]) === false)) { continue; }
        $name = isset($subscriberInfo['name']) ? $subscriberInfo['name'] : $subscriber->name;
        $email = isset($subscriberInfo['email']) ? $subscriberInfo['email'] : $subscriber->email;
        $state = isset($subscriberInfo['state']) ? $subscriberInfo['state'] : $subscriber->state;
        $fields = isset($subscriberInfo['fields']) ? $subscriberInfo['fields'] : $subscriber->xownFieldList;

        $subscriber->updateDetails($name, $email, $state, true, $fields);
      } elseif ($subscriber = reset($this->bean->withCondition(' email = ? ', [$subscriberInfo['email']]) !== false)) {
        $email = $subscriber->email;
        $name = isset($subscriberInfo['name']) ? $subscriberInfo['name'] : $subscriber->name;
        $state = isset($subscriberInfo['state']) ? $subscriberInfo['state'] : $subscriber->state;
        $fields = isset($subscriberInfo['fields']) ? $subscriberInfo['fields'] : $subscriber->xownFieldList;

        $subscriber->updateDetails($name, $email, $state, true, $fields);
      } else {
        if (!isset($subscriberInfo['name']) || !isset($subscriberInfo['state'])) { continue;  }
        $fields = isset($subscriberInfo['fields']) ? $subscriberInfo['fields'] : null;
        $this->addSubscriber($subscriberInfo['name'], $subscriberInfo['email'], $subscriberInfo['state'], $fields);
      }
    }
  }

  public function getSubscriber(int $subscriberId = 0): ?subscriber {
    $subscriber = reset($this->bean->withCondition(' id = ? ', [$subscriberId])->xownSubscriberList);
    return ($subscriber !== false ? $subscriber->box() : null);
  }

  public function addSubscriber(string $name, string $email, string $state, array $fields = null): Response {
    $subscriber = reset($this->bean->withCondition(' email = ? ', [$email])->xownSubscriberList);
    if ($subscriber !== false) {
      return new Response(400, [ 'error' => 'Subscriber with this email address already exists.']);
    }

    $subscriber = R::dispense('subscriber');
    $subscriber->name = $name;
    $subscriber->email = $email;
    $subscriber->state = $state;

    if (!empty($fields)) {
      foreach ($fields as $field) {
        if (isset($field['name']) && isset($field['value'])) {
          $subscriber->addField($field['name'], $field['value']);
        }
      }
    }

    $this->bean->noLoad()->xownSubscriberList[] = $subscriber;
    R::store($this->bean);
    return new Response(201, $subscriber->getDetails(false));
  }

  public function deleteMailinglist(): Response {
    R::trash($this->bean);
    return new Response(200);
  }
}

class subscriber extends \RedBeanPHP\SimpleModel {
  public function getDetails(bool $includeFields = false): array {
    $returnValue = [
      'id' => (int)$this->bean->id,
      'name' => $this->bean->name,
      'email' => $this->bean->email,
      'state' => $this->bean->state,
    ];

    if($includeFields) {
      // Ensure there is an array, even if there are no fields.
      $returnValue['fields'] = [];
      foreach ($this->bean->xownFieldList as $field) {
        $returnValue['fields'][] = $field->getDetails();
      }
    } else {
      $returnValue['fields'] = count($this->bean->xownFieldList);
    }
    return $returnValue;
  }

  public function updateDetails(string $name, string $email, string $state, array $fields = null, bool $clearFields = false): Response {
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
      return new Response(400, [ 'error' => 'Email not formatted correctly' ]);
    }
    $emailDomain = substr($email, strrpos($email, '@') + 1);
    if (!checkdnsrr($emailDomain, "MX")) {
      return new Response(400, [ 'error' => 'Email domain is not valid.' ]);
    }
    if (!in_array(strtolower($state), ['active', 'unsubscribed', 'junk', 'bounced', 'unconfirmed'])){
      return new Response(400, [ 'error' => 'Not a valid state' ]);
    }

    $this->bean->name = $name;
    $this->bean->email = $email;
    $this->bean->state = $state;

    if ($clearFields) {
      $this->bean->xownFieldList = [];
    }
    R::store($this->bean);


    if (!empty($fields)) {
      $beanList = [];
      foreach ($fields as $field) {
        if (!isset($field['name']) || !isset($field['value'])) { continue; }
        $name = $field['name']; $value = $field['value'];
        $fieldBean = reset($this->bean->withCondition(' name = ? ', [ $name ])->xownFieldList);
        if($fieldBean === false){
          $fieldBean = R::dispense('field');
          $beanList[] = $fieldBean;
        }
        $fieldBean->updateDetails($name, $value);
      }
      $this->bean->xownFieldList = $this->bean->xownFieldList + $beanList;
    }

    R::store($this->bean);
    return new Response(200);
  }

  public function getField(int $fieldId): ?field {
    $field = reset($this->bean->withCondition(' id = ? ', [$fieldId])->xownFieldList);
    return ($field !== false ? $field->box() : null);
  }

  public function addField(string $name, $value): Response {
    $field = reset($this->bean->withCondition(' name = ? ', [$name])->xownMailinglistList);
    if ($field !== false) {
      return new Response(400, [ 'error' => 'Mailing list with this name already exists.']);
    }

    $field = R::dispense('field');
    $field->updateDetails($name, $value);

    $this->bean->noLoad()->xownFieldList[] = $field;
    R::store($this->bean);

    return new Response(201);
  }

  public function deleteSubscriber() : Response{
    R::trash($this->bean);
    return new Response(200);
  }
}

class field extends \RedBeanPHP\SimpleModel {
  public function getDetails(): array {
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

  public function updateDetails(string $name, $value): Response {
    switch (gettype($value)) {
      case 'boolean':
        $this->bean->value = $value ? 'true' : 'false';
        $this->bean->type = 'boolean';
        break;
      case 'integer': // Falls through intentially
      case 'double':
        $this->bean->value = (string)$value;
        $this->bean->type = 'number';
        break;
      case 'string':
        $this->bean->value = $value;
        $this->bean->type = 'text';
        break;
      default: // Invalid type, ignore it.
        break;
    }

    $this->bean->name = $name;
    R::store($this->bean);
    return new Response(200);
  }

  public function deleteField(): Response {
    R::trash($this->bean);
    return new Response(200);
  }
}
