#!/bin/bash

for i in `ls | grep .svg`
do
    fname=`echo $i | sed -e 's/svg$/png/'`

    rsvg-convert $i -w 16 -h 16 -o $fname
    zip '../png/16px.zip' $fname

    rsvg-convert $i -w 32 -h 32 -o $fname
    zip '../png/32px.zip' $fname

    zip '../svg.zip' $i

    rm $fname
    rm $i
done
