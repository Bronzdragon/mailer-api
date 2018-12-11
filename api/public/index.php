<?php
namespace MailerAPI;
require_once '../response.php';
require_once '../app.php';


$app = new MailerAPI();

if (!function_exists('getallheaders')) {
  function getallheaders() {
    foreach($_SERVER as $key=>$value) {
      if (substr($key,0,5)=="HTTP_") {
        $key=str_replace(" ","-",ucwords(strtolower(str_replace("_"," ",substr($key,5)))));
        $out[$key]=$value;
      } else {
        $out[$key]=$value;
      }
    }
    return $out;
  }
}

$request = [
  'endpoint' => $_SERVER["REQUEST_URI"],
  'method' => strtolower($_SERVER['REQUEST_METHOD']),
  'headers' => getallheaders(),
  'body' => json_decode(file_get_contents('php://input'), true)
];

$response = $app->ProcessRequest($request);

http_response_code($response->code);

header('Content-Type: application/json');
foreach ($response->headers as $header) {
  header($header);
}

if (isset($response->body)) {
  echo $response->BodyToJson();
}
