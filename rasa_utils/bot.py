from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from builtins import str
from collections import namedtuple

import argparse
import logging
from flask import Flask
from flask_cors import CORS
from gevent.pywsgi import WSGIServer
from threading import Thread
from typing import Text, Optional, Union, List

import rasa_core
from rasa_core import constants, agent
from rasa_core import utils, server
from rasa_core.agent import Agent
from rasa_core.channels import (
    console, RestInput, InputChannel,
    BUILTIN_CHANNELS)
from rasa_core.interpreter import (
    NaturalLanguageInterpreter)
from rasa_core.utils import read_yaml_file, AvailableEndpoints
from .bot_server_channel import BotServerInputChannel

logger = logging.getLogger()  # get the root logger


def create_argument_parser():
    """Parse all the command line arguments for the run script."""

    parser = argparse.ArgumentParser(
            description='starts the bot')
    parser.add_argument(
            '-d', '--core',
            required=True,
            type=str,
            help="core model to run")
    parser.add_argument(
            '-u', '--nlu',
            type=str,
            help="nlu model to run")
    parser.add_argument(
            '-p', '--port',
            default=constants.DEFAULT_SERVER_PORT,
            type=int,
            help="port to run the server at")
    parser.add_argument(
            '--auth_token',
            type=str,
            help="Enable token based authentication. Requests need to provide "
                 "the token to be accepted.")
    parser.add_argument(
            '--cors',
            nargs='*',
            type=str,
            help="enable CORS for the passed origin. "
                 "Use * to whitelist all origins")
    parser.add_argument(
            '-o', '--log_file',
            type=str,
            default="rasa_core.log",
            help="store log file in specified file")
    parser.add_argument(
            '--credentials',
            default=None,
            help="authentication credentials for the connector as a yml file")
    parser.add_argument(
            '--endpoints',
            default=None,
            help="Configuration file for the connectors as a yml file")
    parser.add_argument(
            '-c', '--connector',
            choices=list(BUILTIN_CHANNELS.keys()),
            help="service to connect to")
    parser.add_argument(
            '--enable_api',
            action="store_true",
            help="Start the web server api in addition to the input channel")

    jwt_auth = parser.add_argument_group('JWT Authentication')
    jwt_auth.add_argument(
            '--jwt_secret',
            type=str,
            help="Public key for asymmetric JWT methods or shared secret"
                 "for symmetric methods. Please also make sure to use "
                 "--jwt_method to select the method of the signature, "
                 "otherwise this argument will be ignored.")
    jwt_auth.add_argument(
            '--jwt_method',
            type=str,
            default="HS256",
            help="Method used for the signature of the JWT authentication "
                 "payload.")

    utils.add_logging_option_arguments(parser)
    return parser

def load_agent(core_model, interpreter, endpoints,
               tracker_store=None,
               wait_time_between_pulls=100):
    if endpoints.model:
        return agent.load_from_server(
                interpreter=interpreter,
                generator=endpoints.nlg,
                action_endpoint=endpoints.action,
                model_server=endpoints.model,
                tracker_store=tracker_store,
                wait_time_between_pulls=wait_time_between_pulls
        )
    else:
        return Agent.load(core_model,
                          interpreter=interpreter,
                          generator=endpoints.nlg,
                          tracker_store=tracker_store,
                          action_endpoint=endpoints.action)

def preprocessor(message_text):
    text = message_text.strip()
    return text


if __name__ == '__main__':
    # Running as standalone python application
    arg_parser = create_argument_parser()
    cmdline_args = arg_parser.parse_args()

    logging.getLogger('werkzeug').setLevel(logging.WARN)
    logging.getLogger('matplotlib').setLevel(logging.WARN)

    utils.configure_colored_logging(cmdline_args.loglevel)
    utils.configure_file_logging(cmdline_args.loglevel,
                                 cmdline_args.log_file)

    logger.info("Rasa process starting")

    _endpoints = AvailableEndpoints.read_endpoints(cmdline_args.endpoints)
    _interpreter = NaturalLanguageInterpreter.create(cmdline_args.nlu,
                                                     _endpoints.nlu)
    _agent = load_agent(cmdline_args.core,
                        interpreter=_interpreter,
                        endpoints=_endpoints)

    channel = BotServerInputChannel(_agent, preprocessor=preprocessor, port=cmdline_args.port)
    _agent.handle_channels([channel], http_port=cmdline_args.port)
