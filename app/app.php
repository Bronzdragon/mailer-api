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
    $response = new Response();
    $method = strtoupper($method);

    if (!$this->isAuthenticated()) {
      $response->code = 401;
      //TODO: Send response asking for authentication.
      return $response;
    }

    if (preg_match("#^/api/account/?$#i", $apiEndpoint) === 1) {
      switch ($method) {
        case 'GET':
          $username = 'Dave'; //TODO: Find authenticated user.
          $user = R::findOne('user', 'name = ?', [$username]);

          if (!$user) {
            $response->code = 404;
            return $response;
          }

          $response->code = 200;
          $response->body['name'] = $user->name;
          $response->body['email'] = $user->email;

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

          // TODO:
          $response->body = R::dump($user);

          $response->code = 201;
          return $response;
          break;
        default:
          $response->code = 501;
          return $response;
          break;
      }
      $response->body['name'] = $userName;
      return $response;
    }

    if (preg_match('#^/api/lists/?$#i', $apiEndpoint) === 1) {
      if ($method !== "GET") {
        $response->code = 501;
        return $response;
      }
      $username = 'Dave'; //TODO: Find authenticated user.
      $user = R::findOne('user', 'name = ?', [$username]);

      $user->xownMailinglistList;
      $response->code = 200;
      return $response;
    }

    if (preg_match('#^/api/lists/([^/]+)/?$#i', $apiEndpoint, $matches) === 1) {
      $username = 'Dave'; //TODO: Find authenticated user.
      $user = R::findOne('user', 'name = ?', [$username]);

      $listName = $matches[1];

      switch ($method) {
        case 'GET':
          $list = R::findOne('mailinglist', '(name = ? AND user = ?)', [$listName, $user]);
          if (!$list) {
            $response->code = 404;
            $response->body['error'] = 'No list by that name.';
            return $response;
          }
          $response->code = 200;
          $response->body['list'] = [ 'name' => $list->name ];
          //TODO: List people in the list.
          return $response;
          break;
        case 'PUT':
          if (!isset($request->entries) || !is_array($request->entries)){
            $response->code = 400;
            $response->body['error'] = "Did not provide a new list.";
            return $response;
          }
          $mailingList = R::findOneOrDispense('mailinglist', '(name = ? AND user = ?)', [$listName, $user]);

          foreach ($request->entries as $entry) {
            if (!$this->checkSubscriber($entry)) {
              continue;
            }
            $subscriber = R::dispense('subscriber');
            $subscriber->name = $entry->name;
            $subscriber->email = $entry->email;
            $subscriber->state = $entry->state;

            $mailingList->xownSubscriberList[] = $subscriber;
          }

          R::store($mailingList);

          $response->code = 201;

          return $response;
          break;
        case 'DELETE':
          // code...
          return $response;
          break;
        case 'PATCH':
          // TODO: Implement this?
        default:
          $response->code = 501;
          return $response;
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
      return false;
    }
    if (!\is_string($subscriber->name)) {
      return false;
    }
    if (filter_var($subscriber->email, FILTER_VALIDATE_EMAIL) === false) {
      return false;
    }
    $emailDomain = substr($subscriber->email, strrpos($subscriber->email, '@') + 1);
    if (!\checkdnsrr($emailDomain, "MX")) {
      return false;
    }

    if (!in_array(
      strtolower($subscriber->state),
      ['active', 'unsubscribed', 'junk', 'bounced', 'unconfirmed']))
    {
      return false;
    }

    return true;
  }

  private function isAuthenticated()
  {
    return true;
  }
}
?>
