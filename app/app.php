<?php
namespace MailerAPI;

require_once '../rb.php'; //RedBeanPHP
use R;

define("VERSION", "0.1");
define("CONFIG_LOCATION", "config.json");

class MailerAPI {
  private $config;

  function __construct()
  {
    echo "Loading config";
    R::setup();
    $this->config = $this->LoadConfig(CONFIG_LOCATION);
    $this->SetupDB($this->config->database);
  }

  public function LoadConfig($configLocation='')
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
    switch (strtolower($db->type)) {
      case "mysql": // Falls through
      case "pgsql":
        R::setup($db->connectionString, $db->user, $db->password);
        break;
      case "sqlite":
        R::setup($db->connectionString);
        break;
      default:
        R::setup();
        break;
    }
  }
}

?>
