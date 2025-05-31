#!/bin/bash

# Run the server with the test message as input and capture the output
cat test-add.json | ./run.sh > response.txt

# Print the server's response
cat response.txt 