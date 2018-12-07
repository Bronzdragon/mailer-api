<?php
namespace MailerAPI;

require_once 'rb.php'; //RedBeanPHP
require_once 'models.php';
require_once 'response.php';

use R;

define("VERSION", "0.1");
define("CONFIG_LOCATION", "/vagrant/api/config.json");

class MailerAPI {
  private $config;

  function __construct()
  {
    $this->config = $this->LoadConfig(CONFIG_LOCATION);
    $this->SetupDB($this->config->database);
  }

  public function HandleRequest($method, $apiEndpoint, $headers, $request)
  {
    $response = new Response();
    $method = strtoupper($method);


    // No authentication required to make new accounts.
    if (preg_match("#^/api/account/?$#i", $apiEndpoint) === 1 && $method === 'POST') {
      // If they did not provide the right details.
      if (!isset($request->name) || !isset($request->email)) {
        $response->code = 400;
        $response->body["error"] = "Please provide a username and email address.";
        return $response;
      }

      $user = R::findOne('user', ' name = ? AND email = ?', [$request->name, $request->email]);
      if (!is_null($user)) {
        $response->code = 409;
        $response->body["error"] = "User with that name and email address already exists.";
        return $response;
      }


      $user = R::dispense('user');
      $user->name = $request->name;
      $user->email = $request->email;

      $rawApiKey = $this->getNewAPIKey($user->box(), "Master");
      R::store($user);

      $response->code = 201;
      $response->body = [
        "message" => "User has created.",
        "details" => $user->getDetails() + [ "apikey" => $rawApiKey ]
      ];

      return $response;
    }

    $user = $this->getAuthenticatedUser($headers);
    if (is_null($user)) {
      $response->code = 401;
      $response->body['error'] = 'You must authenticate first.';
      return $response;
    }

    if (preg_match("#^/api/account/?$#i", $apiEndpoint) === 1) {
      if ($method === "GET") {
        $response->code = 200;
        $response->body = $user->getDetails();
        return $response;
      }

      $response->code = 501;
      return $response;
    }

    if (preg_match("#^/api/account/keys(?:/(\d+))?/?$#i", $apiEndpoint, $matches) === 1) {
      $apiKeyIndex = isset($matches[1]) ? (int)$matches[1] : 0;
      if ($apiKeyIndex > 0) { // when working with a specific keys.
        $apiKey = reset($user->withCondition(' id = ? ', [$apiKeyIndex])->xownApikeyList);

        if ($apiKey === false) {
          $response->code = 404;
          $response->body['error'] = "Could not find an API key with index '$apiKeyIndex'.";
          return $response;
        }

        switch ($method) {
          case 'GET':
            $response->code = 200;
            $response->body = [
              'user' => $user->getDetails(),
              'key' => $apiKey->getDetails()
            ];

            return $response;
            break;
          case 'DELETE':
            R::trash($apiKey);
            $response->code = 200;
            $response->body = [
              'message' => 'Key was deleted',
              'name' => $apiKey->name
            ];
            return $response;
            break;
        }
      } else { // No key index provided. Working with all keys.
        switch ($method) {
          case 'GET':
            $response->code = 200;
            $response->body['user'] = $user->getDetails();
            foreach ($user->xownApikeyList as $apiKey) {
              $response->body["keys"][] = $apiKey->getDetails();
            }

            return $response;
            break;
          case 'POST':
            $keyName = isset($request->name) ? $request->name : "default";

            $rawApiKey = $this->getNewAPIKey($user->box(), $keyName);

            $response->code = 201;
            $response->body = $rawApiKey;
            return $response;
            break;
          case 'DELETE':
            $response->code = 405;
            $response->body['error'] = 'Cannot delete all API keys. This would disable access to your account. Delete the account instead.';
            return $response;
            break;
        }
      }
      $response->code = 501;
      $response->body["message"] = "Targeted API key is $apiKeyIndex.";
      return $response;

      // $response->code = 200;
      //
      // return $response;
    }

    if (preg_match('#^/api/lists/?$#i', $apiEndpoint) === 1) {
      if ($method !== "GET") {
        $response->code = 501;
        $response->body["error"] = "Invalid method";
        return $response;
      }

      foreach ($user->xownMailinglistList as $mailingList) {
        $MailingListArray[] = [
          "name" => $mailingList->name,
          "subscriberCount" => count($mailingList->xownSubscriberList)
        ];
      }

      $response->code = 200;
      $response->body["mailing-lists"] = $MailingListArray;
      return $response;
    }

    if (preg_match('#^/api/lists/([^/]+)/?$#i', $apiEndpoint, $matches) === 1) {
      $listName = $matches[1];

      switch ($method) {
        case 'GET':
          $mailingList = reset($user
            ->withCondition(' name = ? LIMIT 1 ', [$listName])
            ->xownMailinglistList);

          if ($mailingList === false) {
            $response->code = 404;
            $response->body['error'] = 'No list by that name.';
            return $response;
          }

          $response->code = 200;
          $response->body['list'] = [ 'name' => $mailingList->name ];

          foreach($mailingList->xownSubscriberList as $subscriber){
            $subscriberList[] = [
              "id" => $subscriber->id,
              "name" => $subscriber->name,
              "email" => $subscriber->email,
              "state" => $subscriber->state,
            ];
          }
          $response->body['subscribers'] = $subscriberList;
          return $response;
          break;
        case 'POST':
          //TODO: Decide if we want to keep this.
          $mailingList = R::dispense('mailinglist');
          $mailingList->name = $listName;
          $user->noLoad()->xownMailinglistList[] = $mailingList;

          // TODO: Allow adding subscribers here.
          R::store($user);

          $response->code = 201;
          $response->body['message'] = 'List created.';

          return $response;
          break;
        case 'PUT':
          $isNewList = false;
          if (!isset($request->entries) || !is_array($request->entries)){
            $response->code = 400;
            $response->body['error'] = "Did not provide a new list.";
            return $response;
          }

          $mailingList = reset($user
            ->withCondition(' name = ? LIMIT 1', [$listName])
            ->xownMailinglistList);

          if ($mailingList === false) {
            $mailingList = R::dispense('mailinglist');
            $mailingList->name = $listName;
            $user->noLoad()->xownMailinglistList[] = $mailingList;
            $isNewList = true;
          }

          $mailingList->xownSubscriberList = array();
          foreach ($request->entries as $entry) {
            if ($this->checkSubscriber($entry) !== true) {
              continue;
            }
            $subscriber = R::dispense('subscriber');
            $subscriber->name = $entry->name;
            $subscriber->email = $entry->email;
            $subscriber->state = $entry->state;

            // TODO: Process fields as well.

            $mailingList->xownSubscriberList[] = $subscriber;
          }

          R::store($user);
          $response->code = 201;
          $message = "Subscriber list '{$mailingList->name}' ";
          $message .= ($isNewList ? 'created.' : 'updated.');
          $response->body['message'] = $message;

          return $response;
          break;
        case 'DELETE':
          $mailingList = reset($user
            ->withCondition(' name = ? LIMIT 1', [$listName])
            ->xownMailinglistList);

          if ($mailingList === false) {
            $response->code = 404;
            $response->body['error'] = "No mailing list found with this name.";
            return $response;
          }

          R::trash($mailingList);
          $response->code = 200;
          $response->body['message'] = "Mailing list '{$mailingList->name}' has been deleted.";

          return $response;
          break;
        case 'PATCH':
          // TODO: Implement this?
        default:
          $response->code = 501;
          return $response;
      }
    }

    if (preg_match('#^/api/lists/([^/]+)/(.+@[^/]+)/?$#i', $apiEndpoint, $matches) === 1) {
      list( 1 => $listName, 2 => $subscriberAddress ) = $matches; // grab the second and third REGEX match.

      $mailingList = reset($user
        ->withCondition(' name = ? LIMIT 1 ', [$listName])
        ->xownMailinglistList);

      if ($mailingList === false) {
        $response->code = 404;
        $response->body["error"] = "The mailing list ('{$listName}') was not found.";
        return $response;
      }

      $subscriber = reset($mailingList
        ->withCondition(' email = ? LIMIT 1 ', [$subscriberAddress])
        ->xownSubscriberList);

      switch ($method) {
        case 'GET':
          if ($subscriber === false) {
            $response->code = 404;
            $response->body["error"] = "There is no subscriber with the address '{$subscriberAddress}' in this mailing list.";
            return $response;
          }

          $response->code = 200;
          $response->body['id'] = $subscriber->id;
          $response->body['name'] = $subscriber->name;
          $response->body['email'] = $subscriber->email;

          // array_values is used because otherwise when it is JSON encoded later,
          // this Array will be treated as an object with sequentially named objects.
          $response->body['fields'] = array_values(array_map(function($field){
            switch ($field->type) {
              case 'boolean':
                $value = ($field->value === "true"); // Convert back to boolean
                break;
              case 'number':
                $value = floatval($field->value);
                break;
              case 'text': // falls through intentionally
              default: // If it's somehow not one of these values, let's just output the value.
                $value = $field->value;
                break;
            }
            return ['name' => $field->name, 'value'=>$value];
          }, $subscriber->xownFieldList));

          return $response;
          break;
        case 'PUT':
          if (!isset($request->email)) {
            $request->email = $subscriberAddress;
          }

          if($errorMessage = $this->checkSubscriber($request) !== true){
            $response->code = 400;
            $response->body['error'] = $errorMessage;
            return $response;
          }

          $newSubscriber = false;
          if ($subscriber === false) {
            $subscriber = R::dispense('subscriber');
            $mailingList->noLoad()->xownSubscriberList[] = $subscriber;
            $newSubscriber = true;
          }

          $subscriber->name = $request->name;
          $subscriber->email = $request->email;
          $subscriber->state = $request->state;

          if (isset($request->fields)) {
            foreach ($request->fields as $jsonField) {
              $field = R::dispense('field');
              $field->name = $jsonField->name;
              switch (gettype($jsonField->value)) {
                case 'boolean':
                  $field->value = ($jsonField->value?"true":"false");
                  $field->type = 'boolean';
                  break;
                case 'integer': // Falls through intentially
                case 'double':
                  $field->value = (string)$jsonField->value;
                  $field->type = 'number';
                  break;
                case 'string': // will handle dates too, since they are encoded as strings in JSON anyway
                  $field->value = $jsonField->value;
                  $field->type = 'text';
                  break;
                default: // invalid type.
                  break;
              }
              $subscriber->noLoad()->xownFieldList[] = $field;
            }
          }

          R::store($mailingList);

          $response->code = 201;
          $response->body["message"] = ($newSubscriber ?
            "New subscriber '{$subscriber->email}' created." :
            "Subscriber '{$subscriber->email}' updated.");
          return $response;
          break;
        case 'DELETE':
          if ($subscriber === false) {
            $response->code = 404;
            $response->body["error"] = "There is no subscriber with the address '{$subscriberAddress}' in this mailing list.";
            return $response;
          }

          R::trash($subscriber);

          $response->code = 200;
          $response->body["message"] = "Subscriber with address '{$subscriber->email}' has been deleted.";
          return $response;
          break;
        case 'PATCH':
          // TODO: Decide wether to implement this.
        default:
          $response->code = 501;
          return $response;
          break;
      }

    }

    $response->code = 400;
    //TODO: This is not a valid endpoint. Send instructions on how to use the API.
    return $response;
  }

  public function LoadConfig($configLocation)
  {
    if (empty($configLocation))
    {
      throw new Exception('No config location provided.');
    }

    $json = file_get_contents($configLocation);
    return json_decode($json);
  }

  private function SetupDB($database)
  {
    if(R::testConnection()) return; // If the Database is already set up, quit out early.

    switch (strtolower($database->type)) {
      case "mysql": // Falls through
      case "pgsql":
        R::setup($database->connectionString, $database->user, $database->password);
        break;
      case "sqlite":
        R::setup($database->connectionString);
        break;
      default:
        R::setup();
        break;
    }
  }

  private function checkSubscriber($subscriber)
  {
    if ( !isset($subscriber)
      || !isset($subscriber->name)
      || !isset($subscriber->email)
      || !isset($subscriber->state) )
    {
      return 'Email/name/state not set.';
    }
    if (!\is_string($subscriber->name)) {
      return 'Name is not a string.';
    }

    if (filter_var($subscriber->email, FILTER_VALIDATE_EMAIL) === false) {
      return 'Email not formatted correctly';
    }

    $emailDomain = substr($subscriber->email, strrpos($subscriber->email, '@') + 1);
    if (!\checkdnsrr($emailDomain, "MX")) {
      return 'Email domain is not valid.';
    }

    if (!in_array(
      strtolower($subscriber->state),
      ['active', 'unsubscribed', 'junk', 'bounced', 'unconfirmed']))
    {
      return 'State is not accepted.';
    }
    if (isset($subscriber->fields)) {
      // Checks to see if all of the fields have a value and a name.

      $allFieldsValid = array_reduce($subscriber->fields, function($carry, $field){
        return $carry
        && isset($field->name)
        && isset($field->value)
        && in_array(gettype($field->value), ['boolean', 'integer', 'double', 'string']);
      }, true);
      if (!$allFieldsValid) {

        return "Invalid JSON: " . json_encode($subscriber->fields);
        // return 'There is an issue with one of the fields.';
      }
    }

    return true;
  }

  private function getAuthenticatedUser(array $headers)
  {
    if (!isset($headers['Email']) || !isset($headers["Api-Key"])) {
      return NULL;
    }

    $email = $headers['Email'];
    $apiKey = $headers["Api-Key"];
    $user = R::findOne('user', ' email = ? ', [$email]);
    if (is_null($user)) { return NULL; }

    foreach ($user->xownApikeyList as $apiKeyBean) {
      if (password_verify($apiKey, $apiKeyBean->hash)) {
        return $user;
      }
    }

    return NULL;
  }

  private function getRandomBytes(int $nbBytes = 32)
  {
      $bytes = openssl_random_pseudo_bytes($nbBytes, $strong);
      if (false !== $bytes && true === $strong) {
          return $bytes;
      }
      else {
          throw new \Exception("Unable to generate secure token from OpenSSL.");
      }
  }

  private function generatePasskey(int $length = 32){
    $newPassword = preg_replace("/[^a-zA-Z0-9]/", "", base64_encode($this->getRandomBytes($length+1)));
    return strlen($newPassword) >= $length
      ? substr($newPassword, 0, $length)
      : $newPassword . $this->generatePasskey($length - strlen($newPassword));
  }

  private function getNewAPIKey(User $user, string $name = "default"){
    $userBean = $user->unbox();
    $raw = $this->generatePasskey();

    $hashed = password_hash($raw, PASSWORD_BCRYPT);
    $apiKey = R::dispense('apikey');
    $apiKey->hash = $hashed;
    $apiKey->name = $name;
    $userBean->xownApikeyList[] = $apiKey;
    R::store($userBean);

    return $raw;
  }
}
