import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { getActions } from './actions.js'
import { getVariables } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import { getPresets } from './presets.js'
import { UpgradeScripts } from './upgrades.js'

import { UniversalSpeedtest, SpeedUnits } from 'universal-speedtest'

class SpeedtestInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config

		this.updateStatus(InstanceStatus.Ok)

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.initPresets()

		this.universalSpeedtest = new UniversalSpeedtest({
			debug: true,
			measureUpload: true,
			downloadUnit: SpeedUnits.Mbps,
		})

		this.runTest()
	}

	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		this.init(config)
	}

	getConfigFields() {
		return [
			{
				type: 'dropdown',
				id: 'service',
				label: 'Service',
				choices: [
					{ id: 'cloudflare', label: 'Cloudflare' },
					{ id: 'speedtest', label: 'Speedtest.net' },
				],
				default: 'cloudflare',
			},
		]
	}

	updateActions() {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	updateFeedbacks() {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	updateVariableDefinitions() {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
	}

	initPresets() {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	runTest() {
		this.testComplete = false
		this.setVariableValues({ test_status: 'Running' })
		this.checkFeedbacks('testStatus')

		if (this.config?.service === 'cloudflare') {
			this.universalSpeedtest
				.runCloudflareCom()
				.then((result) => {
					this.processTest(result)
					this.updateStatus(InstanceStatus.Ok)
				})
				.catch((error) => {
					this.log('error', error.message)
					this.updateStatus(InstanceStatus.ConnectionFailure)
				})
		} else {
			this.universalSpeedtest
				.runSpeedtestNet()
				.then((result) => {
					this.processTest(result)
					this.updateStatus(InstanceStatus.Ok)
				})
				.catch((error) => {
					this.log('error', error.message)
					this.updateStatus(InstanceStatus.ConnectionFailure)
				})
		}
	}

	processTest(data) {
		this.testComplete = true
		this.testResult = data

		this.setVariableValues({
			test_status: 'Complete',
			download_speed: data.downloadSpeed,
			upload_speed: data.uploadSpeed,
			ping: data.ping,
			jitter: data.jitter,
			server_city: data.server?.city,
			server_distance: data.server?.distance,
			client_public_ip: data.client?.ip,
		})

		this.checkFeedbacks('resultCheck', 'testStatus')
	}
}

runEntrypoint(SpeedtestInstance, UpgradeScripts)
