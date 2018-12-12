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
      switch ($request['method']) {
        case 'get':
          if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
            return new Response(401, ['error' => 'You are not authenticated']);
          }
          return new Response(200, $user->getDetails());
          break;
        case 'post':
          if (!isset($request['body']['name']) || !isset($request['body']['email'])) {
            return new Response(400, ['error' => 'Both name and email are required properties.']);
          }
          return user::createUser($request['body']['name'], $request['body']['email']);
          break;
        case 'put':
          if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
            return new Response(401, ['error' => 'You are not authenticated']);
          }

          if (!isset($request['body']['name']) || !isset($request['body']['email'])) {
            return new Response(400, ['error' => 'Both name and email are required properties.']);
          }
          return $user->updateDetails($request['body']['name'], $request['body']['email']);
          break;
        case 'patch':
          if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
            return new Response(401, ['error' => 'You are not authenticated']);
          }
          $name = !empty($request['body']['name']) ? $request['body']['name'] : $user->name;
          $email = !empty($request['body']['email']) ? $request['body']['email'] : $user->email;
          return $user->updateDetails($name, $email);
          break;
        case 'delete':
          if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
            return new Response(401, ['error' => 'You are not authenticated']);
          }
          $deleteFlag = isset($request['body']['confirmDelete']) && $request['body']['confirmDelete'];
          return $user->deleteUser($deleteFlag);
          break;
      }
      return new Response(501);
    }

    // keys endpoint
    if (preg_match("#^/api/account/keys(?:/(\d+))?/?$#i", $request['endpoint'], $matches) === 1) {
      $keyid = isset($matches[1]) ? $matches[1] : null;
      if(is_null($keyid)){
        switch ($request['method']) {
          case 'get':
            if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
              return new Response(401, ['error' => 'You are not authenticated']);
            }
            return new Response(200, $user->getDetails(false, true));

            break;
          case 'post':
            // code...
            break;
          default:
            return new Response(501);
            break;
        }
      } else { // if we're targeting a specific key.
        switch ($request['method']) {
          case 'get':
            if (is_null($user = user::getAuthenticatedUser($request['headers']))) {
              return new Response(401, ['error' => 'You are not authenticated']);
            }
            if (is_null($key = $user->getKey($keyid))) {
              return new Response(404, ['error' => 'No key with that ID found.']);
            }
            return new Response(200, $key->getDetails());
            break;
          case 'put':
            // code...
            break;
          case 'patch':
            // code...
            break;
          case 'delete':
            // code...
            break;
          default:
            return new Response(501);
            break;
        }
      }
    }

    // Mailing list endpoint
    if (preg_match('#^/api/mailinglists(?:/(\d+))?/?$#i', $request['endpoint'], $matches) === 1) {
      $listid = isset($matches[1]) ? $matches[1] : null;

    }

    // Subscriber endpoint
    if (preg_match('#^/api/mailinglists/(\d+)/subscribers/(?:(\d+))?/?$#i', $request['endpoint'], $matches) === 1) {
      $listid = $matches[1];
      $subscriberid = isset($matches[2]) ? $matches[2] : null;

    }

    if (preg_match('#^/api/mailinglists/(\d+)/subscribers/(\d+)/fields/?$#i', $request['endpoint'], $matches) === 1) {
      $listid = $matches[1];
      $subscriberid = $matches[2];

    }

    return new Response(404, ['error' => 'Not a validpoint.']);
    // endpoint invalid.
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
