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
    //$this->SetupDB($this->config->database);
  }

  public function HandleRequest($method, $apiEndpoint, $headers, $jsonRequest = '')
  {
    if (!$this->isAuthenticated()) {
      // Send response asking for authentication.
    }

    $response = new Response();
    $response->body->endpoint = $apiEndpoint;
    // "#api/account/([\/]*)/?#"
    if (preg_match("#api/account/([^/]*)/?#i", $apiEndpoint, $allMatches) === 1) {
      $userName = $allMatches[1];
      $response->body->name = $userName;
      return $response;
    }

    if (strpos($apiEndpoint, "api/lists") === 0) { // If it is a valid API request
      // code...
    }

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
