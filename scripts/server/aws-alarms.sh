#!/usr/bin/env bash
# Self-healing CloudWatch alarms for the AirPair WS server (run once, from a workstation).
# - Instance check failed (OS hung, e.g. OOM)  -> EC2 reboot (hard reboot if the OS doesn't respond)
# - System check failed (AWS host failure)     -> EC2 recover (migrates to healthy hardware, keeps EIP)
# Idempotent: put-metric-alarm overwrites an alarm with the same name. Context: docs/decisions.md D11.
set -euo pipefail

REGION=eu-west-1
INSTANCE=i-00d544c3b5e3ea343

alarm() { # name metric action
  aws cloudwatch put-metric-alarm --region "$REGION" \
    --alarm-name "$1" \
    --alarm-description "AirPair WS server self-healing (D11)" \
    --namespace AWS/EC2 --metric-name "$2" \
    --dimensions "Name=InstanceId,Value=$INSTANCE" \
    --statistic Maximum --period 60 --evaluation-periods 5 --datapoints-to-alarm 5 \
    --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data missing \
    --alarm-actions "arn:aws:automate:$REGION:ec2:$3"
  echo "alarm $1 -> $3"
}

alarm airpair-server-auto-reboot  StatusCheckFailed_Instance reboot
alarm airpair-server-auto-recover StatusCheckFailed_System   recover
