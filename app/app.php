<?php
namespace MailerAPI;

require_once 'rb.php'; //RedBeanPHP
// require_once 'account.php';
require_once 'response.php';
use R;

define("VERSION", "0.1");
define("CONFIG_LOCATION", "/vagrant/app/config.json");

class MailerAPI {
  private $config;


  function __construct()
  {
    R::setup();
    $this->config = $this->LoadConfig(CONFIG_LOCATION);
    $this->SetupDB($this->config->database);
  }

  public function HandleRequest($method, $apiEndpoint, $headers, $request)
  {
    if (!$this->isAuthenticated()) {
      // Send response asking for authentication.
      $response->code = 401;
    }

    $response = new Response();
    $method = strtoupper($method);
    //$response->body->endpoint = $apiEndpoint;
    if (preg_match("#^/api/account/?$#i", $apiEndpoint) === 1) {
      switch ($method) {
        case 'GET':
          //TODO: Find authenticated user.
          $user = R::find('user', 'name = ? LIMIT 1', ['James']);

          if (!$user) {
            $response->code = 404;
            return $response;
          }

          $response->code = 200;
          $response->body->name = $user->name;
          $response->body->email = $user->email;

          return $response;
          break;
        case 'POST':
          if (!isset($request->name) || !isset($request->email)) {
            $response->code = 400;
            return $response;
          }

          $user = R::findOne('user', ' name = ? AND email = ?', [$request->name, $request->email]);
          if ($user) {
            $response->code = 409;
            return $response;
          }

          $user = R::dispense('user');
          $user->name = $request->name;
          $user->email = $request->email;
          $userId = R::store($user);
          $response->body = R::dump($user);

          $response->code = 201;
          return $response;
          break;
        default:
          $response->code = 501;
          return $response;
          break;
      }
      $response->body->name = $userName;
      return $response;
    }

    if (preg_match("#^/api/lists.*$#i", $apiEndpoint) === 1) { // If it is a valid API request
      //TODO: Deal with this stuff.
      $response->body->TODO = "Complete this.";
      return $response;
    }

    $response->code = 400;
    //TODO: If no other part matches, send instructions on how to use the API.
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

  private function isAuthenticated()
  {
    return true;
  }
}
?>
