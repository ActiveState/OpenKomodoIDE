#!/bin/bash

for i in `ls | grep .svg`
do
    fname=`echo $i | sed -e 's/svg$/png/'`

    rsvg-convert $i -w 14 -h 14 -o $fname
    zip '../png/14px.zip' $fname

    rsvg-convert $i -w 28 -h 28 -o $fname
    zip '../png/28px.zip' $fname

    zip '../svg.zip' $i

    rm $fname
    rm $i
done
