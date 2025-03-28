<?php
header("Access-Control-Allow-Origin: *");  // Allow any origin (for development)
header("Access-Control-Allow-Methods: GET, OPTIONS");  
header("Access-Control-Allow-Headers: Content-Type");

require_once 'config.php'; // Load API key from config.php

// Get query parameters from the frontend
$query = urlencode($_GET['query']);
$lang = urlencode($_GET['lang']); // Get language setting
$apiUrl = "https://api.bing.microsoft.com/v7.0/images/search?q=$query&setLang=$lang";
$options = [
    'http' => [
        'header' => "Ocp-Apim-Subscription-Key: " . SEARCH_API_KEY,
        'method' => 'GET'
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($apiUrl, false, $context);

// Return Bing API response to the frontend
echo $response;