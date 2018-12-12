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

  public function getKey(int $keyId): ?apikey {
    $key = reset($this->bean->withCondition(' id = ? ', [$keyId])->xownApikeyList);
    return ($key !== false ? $key->box() : null);
  }

  public function updateDetails(string $name = null, string $email = null): Response {
    $this->bean->name = $name;
    $this->bean->email = $email;

    R::store($this->bean);
    return new Response(200);
  }

  public function addAPIKey(string $name = 'default'): Response {
    $rawKey = apikey::generatePasskey();

    $apiKey = R::dispense('apikey');
    $apiKey->hash = password_hash($rawKey, PASSWORD_BCRYPT);
    $apiKey->name = $name;
    $this->bean->noLoad()->xownApikeyList[] = $apiKey;

    R::store($this->bean);

    $this->getDetails();

    return new Response(201, $this->getDetails() + [
      'message' => 'API key created.',
      'key' => $rawKey
    ]);
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

    // Bean will be stored when we add an APIkey.
    $response = $user->addAPIKey('master');
    $response->body = ['message' => 'User created.'] + $response->body;
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
    }

    return $returnValue;
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
    }
    return $returnValue;
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
}
