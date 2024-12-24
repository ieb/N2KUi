#!/bin/bash

rm -rf /Volumes/UNTITLED/ui/n2k
mkdir -p /Volumes/UNTITLED/ui/n2k
rsync --exclude=node_modules -r -v -L src/ /Volumes/UNTITLED/ui/n2k
