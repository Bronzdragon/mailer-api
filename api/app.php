<?php
namespace MailerAPI;

require_once 'rb.php'; //RedBeanPHP
require_once 'models.php';
require_once 'response.php';

use R;

define("VERSION", "0.1");
define("CONFIG_LOCATION", "/vagrant/api/config.json");

class MailerAPI {
  function __construct() {
    $this->config = $this->LoadConfig(CONFIG_LOCATION);
    MailerAPI::SetupDB($this->config->database);
  }

  public function ProcessRequest(array $request) : Response {
    // Base endpoint.
    if (preg_match('#^/api/?$#i', $request['endpoint']) === 1) {
      if ($request['method'] === 'get') {
        // TODO: create proper introduction
        return new Response(200, ['message' => 'Welcome to the Mail API.']);
      }
      return new Response(501);
    }

    // Account endpoint
    if (preg_match('#^/api/account/?$#i', $request['endpoint']) === 1) {
      if ($request['method'] === 'post') {
        if (!isset($request['body']['name']) || !isset($request['body']['email'])) {
          return new Response(400, ['error' => 'Both name and email are required properties.']);
        }
        return user::createUser($request['body']['name'], $request['body']['email']);
      }

      if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
        return new Response(401, ['error' => 'You are not authenticated']);
      }

      switch ($request['method']) {
        case 'get':
          return new Response(200, $user->getDetails());
          break;
        case 'put':
          if (!isset($request['body']['name']) || !isset($request['body']['email'])) {
            return new Response(400, ['error' => 'Both name and email are required properties.']);
          }
          return $user->updateDetails($request['body']['name'], $request['body']['email']);
          break;
        case 'patch':
          $name = !empty($request['body']['name']) ? $request['body']['name'] : $user->name;
          $email = !empty($request['body']['email']) ? $request['body']['email'] : $user->email;
          return $user->updateDetails($name, $email);
          break;
        case 'delete':
          $deleteFlag = isset($request['body']['confirmDelete']) && $request['body']['confirmDelete'];
          return $user->deleteUser($deleteFlag);
          break;
      }
      return new Response(501);
    }

    // keys endpoint
    if (preg_match("#^/api/account/keys(?:/(\d+))?/?$#i", $request['endpoint'], $matches) === 1) {
      $keyid = isset($matches[1]) ? $matches[1] : null;
      if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
        return new Response(401, ['error' => 'You are not authenticated']);
      }

      if(is_null($keyid)) {
        switch ($request['method']) {
          case 'get':
            return new Response(200, $user->getDetails(false, true));
            break;
          case 'post':
            $name = isset($request['body']['name']) ? $request['body']['name'] : 'default';
            return $user->addAPIKey($name);
            break;
          case 'patch':
            $numUpdatedKeys = 0;
            if (!is_array($request['body'])) {
              return new Response(400, ['message' => 'Please provide a valid array.']);
            }
            foreach ($request['body'] as $newKey) {
              if (isset($newKey['id']) && isset($newKey['name']) && $key = $user->getAPIkey($newKey['id'])) {
                $key->updateDetails($newKey['name']);
                $numUpdatedKeys++;
              }
            }
            // $message =
            return new Response(200, ['message' => "$numUpdatedKeys ".($numUpdatedKeys === 1 ?'key has':'keys have').' been updated.']);
            break;
          case 'delete':
            $numDeletedKeys = 0;
            if (!is_array($request['body'])) {
              return new Response(400, ['message' => 'Please provide a valid array.']);
            }
            foreach ($request['body'] as $keyId) {
              if (is_numeric($keyId)) {
                $user->getAPIkey($keyId)->deleteKey();
                $numDeletedKeys++;
              }
            }
            return new Response(200, ['message' => "$numDeletedKeys ".($numDeletedKeys === 1 ?'key has':'keys have').' been deleted.']);
            break;
        }
      } else { // if we're targeting a specific key.
        if (is_null($key = $user->getAPIkey($keyid))) {
          return new Response(404, ['error' => 'No key with that ID found.']);
        }
        switch ($request['method']) {
          case 'get':
            return new Response(200, $key->getDetails());
            break;
          case 'put': // Falls through intentionally.
          case 'patch':
            if (!isset($request['body']['name'])) {
              return new Response(400, ['error' => 'A name is required.']);
            }
            return $key->updateDetails($request['body']['name']);
            break;
          case 'delete':
            return $key->deleteKey();
            break;
        }
      }
      return new Response(501);
    }

    // Mailing list endpoint
    if (preg_match('#^/api/mailinglists(?:/(\d+))?/?$#i', $request['endpoint'], $matches) === 1) {
      $listId = isset($matches[1]) ? $matches[1] : null;
      if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
        return new Response(401, ['error' => 'You are not authenticated']);
      }
      if (is_null($listId)) {
        switch ($request['method']) {
          case 'get':
            return new Response(200, $user->getDetails(true, false));
            break;
          case 'post':
            if (!isset($request['body']['name'])) {
              return new Response(400, ['error' => 'Please provide a name.']);
            }
            return $user->addMailinglist($request['body']['name']);
            break;
        }
      } else {
        if (is_null($mailinglist = $user->getMailinglist($listId))) {
          return new Response(404, ['error' => 'No mailing list with that ID found.']);
        }
        switch ($request['method']) {
          case 'get':
            return new Response(200, $mailinglist->getDetails(true));
            break;
          case 'put':
            if (!isset($request['body']['name']) || !isset($request['body']['subscribers'])) {
              return new Response(400, ['error' => 'Please provide a name and a list of subscribers.']);
            }
            return $mailinglist->updateDetails($request['body']['name'], $request['body']['subscribers'], true);
            break;
          case 'patch':
            $name = isset($request['body']['name']) ? $request['body']['name'] : $mailinglist->name;
            $list = isset($request['body']['subscribers']) ? $request['body']['subscribers'] : null;
            return $mailinglist->updateDetails($name, $list, false);
            break;
          case 'delete':
            return $mailinglist->deleteMailinglist();
            break;
        }
      }
      return new Response(501);
    }

    // Subscriber endpoint
    if (preg_match('#^/api/mailinglists/(\d+)/subscribers/(?:(\d+))?/?$#i', $request['endpoint'], $matches) === 1) {
      if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
        return new Response(401, ['error' => 'You are not authenticated']);
      }

      $listId = $matches[1];
      if (is_null($mailinglist = $user->getMailinglist($listId))) {
        return new Response(404, ['error' => 'No mailing list with that ID found.']);
      }
      $subscriberid = isset($matches[2]) ? $matches[2] : null;
      if (is_null($subscriberid)) {
        switch ($request['method']) {
          case 'get':
            return new Response(200, $mailinglist->getDetails(true));
            break;
          case 'post':
            function addSubscriber($body, $mailinglist) {
              if ((!isset($body['name'])  || !is_string($body['name']))
              ||  (!isset($body['email']) || !is_string($body['email']))
              ||  (!isset($body['state']) || !is_string($body['state']))) {
                // echo "<p>INVALID STATE DETECTED!:</p>";
                // var_dump($body);
                return new Response(400, ['error' => 'Please provide a name, an email address and an initial state.']);
              }

              $fieldList = (isset($body['fields']) && is_array($body['fields']))
              ? $body['fields']
              : null;

              return $mailinglist->addSubscriber($body['name'], $body['email'], $body['state'], $fieldList);
            }

            if(has_string_keys($request['body'])){
              return addSubscriber($request['body'], $mailinglist);
            } else {
              $total = 0;
              foreach ($request['body'] as $req) {
                $response = addSubscriber($req, $mailinglist);
                // var_dump($response);
                if ($response->code === 201) { $total += 1; }
                // var_dump($total);
              }
              return new Response(200, ['message' => "$total subscribers added"]);
            }

            break;
        }
      } else { // If we're targeting a specific subscriber.
        if (is_null($subscriber = $mailinglist->getSubscriber($subscriberid))) {
          return new Response(404, ['error' => 'No subscriber with that ID found.']);
        }
        switch ($request['method']) {
          case 'get':
            return new Response(200, $subscriber->getDetails(true));
            break;
          case 'put':
            if (!isset($request['body']['name']) || !isset($request['body']['email']) || !isset($request['body']['state'])) {
              return new Response(400, ['error' => 'Please provide a name, an email address and an initial state.']);
            }
            $fieldList = isset($request['body']['fields']) ? $request['body']['fields'] : null;

            return $subscriber->updateDetails($request['body']['name'], $request['body']['email'], $request['body']['state'], $fieldList, true);
            break;
          case 'patch':
            if (!isset($request['body']['name']) && !isset($request['body']['email']) && !isset($request['body']['state']) && !isset($request['body']['fields'])) {
              return new Response(400, ['error' => 'Please provide a name, an email address, a state, or a list of subscribers.']);
            }

            $name = isset($request['body']['name']) ? $request['body']['name'] : $subscriber->name;
            $email = isset($request['body']['email']) ? $request['body']['email'] : $subscriber->email;
            $state = isset($request['body']['state']) ? $request['body']['state'] : $subscriber->state;
            $fields = isset($request['body']['fields']) ? $request['body']['fields'] : null;
            return $subscriber->updateDetails($name, $email, $state, $fields, false);
            break;
          case 'delete':
            return $subscriber->deleteSubscriber();
            break;
        }
      }
      return new Response(501);
    }
    return new Response(404, ['error' => 'Not a valid endpoint.']);
  }

  public function LoadConfig($configLocation) : \stdClass {
    if (empty($configLocation))
    {
      throw new Exception('No config location provided.');
    }

    $json = file_get_contents($configLocation);
    return json_decode($json);
  }

  private static function SetupDB($database) : void {
    if(R::testConnection()) return; // If the Database is already set up, quit out early.

    switch (strtolower($database->type)) {
      case "mysql": // Falls through intentionally
      case "pgsql":
        R::setup($database->connectionString, $database->user, $database->password);
        break;
      case "sqlite":
        R::setup($database->connectionString);
        break;
      default:
        R::setup();
    }
  }
}

function has_string_keys(array $array) {
  return count(array_filter(array_keys($array), 'is_string')) > 0;
}
